import { useEffect, useState } from "react"
import { initialOrgs } from "./IngoDashboard"
import { Field, field } from "./Ingo"
import { downloadDeviceFile, readDeviceFile, saveDeviceFile, useLocal, readLS, writeLS, type StoredLocalFile } from "./store"

const templates = {
  "rekomendasi-kl": {
    title: "Surat Rekomendasi Calon K/L Mitra",
    subject: "Penawaran kerja sama dengan INGO",
    body: "Dengan hormat,\n\nBerdasarkan hasil penilaian TPOA, kami menyampaikan penawaran kerja sama antara [nama INGO] dan [calon K/L mitra].\n\nBidang program: [isi bidang]\nWilayah kerja: [isi wilayah]\nMasa kerja sama: [isi masa kerja sama]\n\nKami mohon kesediaan [calon K/L mitra] untuk meninjau usulan kerja sama ini.\n\nHormat kami,\nKetua TPOA",
  },
  "izin-prinsip-sementara": {
    title: "Surat Izin Prinsip Sementara",
    subject: "Penerbitan izin prinsip sementara",
    body: "Dengan hormat,\n\nSetelah calon K/L mitra menyatakan persetujuan, TPOA menerbitkan izin prinsip sementara bagi [nama INGO] untuk menindaklanjuti kerja sama dengan [calon K/L mitra].\n\nMasa berlaku: [isi masa berlaku]\nKetentuan: [isi ketentuan]\n\nHormat kami,\nKetua TPOA",
  },
  "rekomendasi-msp": {
    title: "Surat Rekomendasi Penandatanganan MSP",
    subject: "Rekomendasi penandatanganan Memorandum Saling Pengertian",
    body: "Dengan hormat,\n\nSehubungan dengan persetujuan kerja sama antara [nama INGO] dan [calon K/L mitra], TPOA merekomendasikan penandatanganan Memorandum Saling Pengertian (MSP).\n\nRuang lingkup kerja sama: [isi ruang lingkup]\nJangka waktu MSP: [isi jangka waktu]\n\nHormat kami,\nKetua TPOA",
  },
  "izin-prinsip-tetap": {
    title: "Surat Izin Prinsip Tetap",
    subject: "Penerbitan izin prinsip tetap",
    body: "Dengan hormat,\n\nSetelah MSP ditandatangani oleh [nama INGO] dan [calon K/L mitra], TPOA menerbitkan izin prinsip tetap untuk pelaksanaan program kerja sama.\n\nNomor MSP: [isi nomor MSP]\nMasa berlaku: [isi masa berlaku]\nWilayah kerja: [isi wilayah]\n\nHormat kami,\nKetua TPOA",
  },
} as const

export type LetterType = keyof typeof templates
type Decision = { result: "setuju" | "tolak"; recipient: string; statement: string; updatedAt: number } | null
type PartnerApprovalRecord = { senderEmail: string; verifiedByTpoa: boolean }
type RecommendationInvitation = { id: string; orgId: string; orgName: string; partnerEmail: string; partnerName: string; number: string; subject: string; body: string; issuedAt: number }
type PartnerSubmission = { invitationId: string; orgId: string; orgName: string; partnerEmail: string; partnerName: string; recommendationNumber: string; recommendationSubject: string; decision: "setuju" | "tolak"; signerName: string; signerTitle: string; statement: string; submittedAt: number }

function encodePortalPayload(value: unknown) {
  const bytes = new TextEncoder().encode(JSON.stringify(value))
  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")
}

function decodePortalPayload<T>(value: string | null): T | null {
  if (!value) return null
  try {
    const base64 = value.replace(/-/g, "+").replace(/_/g, "/")
    const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="))
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0))
    return JSON.parse(new TextDecoder().decode(bytes)) as T
  } catch {
    return null
  }
}

function publicPortalLink(query: string) {
  const base = import.meta.env.VITE_PUBLIC_APP_URL || `${window.location.origin}${window.location.pathname}`
  return `${base}#/surat/persetujuan-kl?${query}`
}

function downloadTextFile(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }))
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 60000)
}

function usePartnerApprovalFile(orgId: string) {
  const fileKey = `tpoa:partner-approval-file:${orgId}`
  const [file, setFile] = useState<StoredLocalFile | null>(null)
  const [message, setMessage] = useState("")
  useEffect(() => {
    let active = true
    readDeviceFile(fileKey).then((stored) => { if (active) setFile(stored) }).catch(() => { if (active) setMessage("Penyimpanan berkas tidak dapat dibuka di browser ini.") })
    return () => { active = false }
  }, [fileKey])
  const receive = async (upload: File | undefined) => {
    if (!upload) return false
    if (upload.type !== "application/pdf" && !upload.name.toLowerCase().endsWith(".pdf")) {
      setMessage("Lampiran persetujuan harus berupa PDF.")
      return false
    }
    if (upload.size > 15 * 1024 * 1024) {
      setMessage("Ukuran PDF maksimal 15 MB.")
      return false
    }
    try {
      await saveDeviceFile(fileKey, upload)
      const stored = await readDeviceFile(fileKey)
      setFile(stored)
      setMessage(stored ? `Balasan diterima dan status persetujuan diperbarui otomatis pada ${new Date(stored.updatedAt).toLocaleString("id-ID").replace(/\\./g, ":")}.` : "Berkas belum dapat dibaca kembali.")
      return stored !== null
    } catch {
      setMessage("PDF tidak dapat disimpan. Periksa ruang penyimpanan browser lalu coba lagi.")
      return false
    }
  }
  const open = () => {
    if (!file) return
    const url = URL.createObjectURL(file.blob)
    window.open(url, "_blank", "noopener,noreferrer")
    window.setTimeout(() => URL.revokeObjectURL(url), 60000)
  }
  return { file, message, receive, open }
}

export function LetterEditorPage({ letterType }: { letterType: LetterType }) {
  const [orgId, setOrgId] = useLocal("tpoa:active-ingo", initialOrgs[0].id)
  return <LetterDraft key={`${letterType}:${orgId}`} letterType={letterType} orgId={orgId} setOrgId={setOrgId} />
}

export function PartnerApprovalPage() {
  const params = new URLSearchParams(window.location.hash.split("?")[1] ?? "")
  const invitation = decodePortalPayload<RecommendationInvitation>(params.get("invitation"))
  const submission = decodePortalPayload<PartnerSubmission>(params.get("submission"))
  if (invitation) return <PartnerApprovalForm invitation={invitation} />
  return <PartnerApprovalInbox incomingSubmission={submission} />
}

function PartnerApprovalForm({ invitation }: { invitation: RecommendationInvitation }) {
  const [decision, setDecision] = useState<"setuju" | "tolak">("setuju")
  const [signerName, setSignerName] = useState("")
  const [signerTitle, setSignerTitle] = useState("")
  const [statement, setStatement] = useState(`Kami menyetujui surat rekomendasi TPOA nomor ${invitation.number} perihal ${invitation.subject} untuk kerja sama ${invitation.orgName}.`)
  const canSubmit = Boolean(signerName.trim() && signerTitle.trim() && statement.trim())
  const sendToTpoa = () => {
    if (!canSubmit) return
    const response: PartnerSubmission = {
      invitationId: invitation.id,
      orgId: invitation.orgId,
      orgName: invitation.orgName,
      partnerEmail: invitation.partnerEmail,
      partnerName: invitation.partnerName,
      recommendationNumber: invitation.number,
      recommendationSubject: invitation.subject,
      decision,
      signerName: signerName.trim(),
      signerTitle: signerTitle.trim(),
      statement: statement.trim(),
      submittedAt: Date.now(),
    }
    writeLS(`tpoa:partner-submission:${response.orgId}`, response)
    writeLS(`tpoa:partner-approval-record:${response.orgId}`, { senderEmail: response.partnerEmail, verifiedByTpoa: false })
    const payload = encodeURIComponent(encodePortalPayload(response))
    window.location.hash = `/surat/persetujuan-kl?submission=${payload}`
  }
  if (!initialOrgs.some((org) => org.id === invitation.orgId) || Date.now() - invitation.issuedAt > 14 * 24 * 60 * 60 * 1000) return <section className="glass p-5"><h1 className="font-display text-xl">Tautan tidak berlaku</h1><p className="mt-2 text-[13px] text-muted">Undangan tidak ditemukan atau sudah kedaluwarsa. Hubungi TPOA untuk meminta tautan baru.</p></section>
  return <div>
    <header className="mb-6 border-b border-slate-300/70 pb-5">
      <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-forest-deep">Formulir Calon K/L · Balasan TPOA</div>
      <h1 className="mt-2 font-display text-[32px] leading-tight">Persetujuan Surat Rekomendasi</h1>
      <p className="mt-2 text-[13px] text-muted">Untuk {invitation.partnerName} · INGO: {invitation.orgName}</p>
    </header>
    <div className="mb-5 border-l-4 border-ochre bg-ochre-soft p-4 text-[12px] leading-relaxed">Mode uji coba: setelah dikirim, halaman langsung kembali ke inbox TPOA pada browser/perangkat yang sama. Jangan gunakan untuk data rahasia/operasional.</div>
    <section className="glass mb-5 max-w-3xl p-5">
      <h2 className="font-display text-xl">Surat rekomendasi dari TPOA</h2>
      <dl className="mt-4 grid gap-3 text-[13px]">
        <div><dt className="font-semibold">Nomor surat</dt><dd>{invitation.number}</dd></div>
        <div><dt className="font-semibold">Perihal</dt><dd>{invitation.subject}</dd></div>
        <div><dt className="font-semibold">Isi surat</dt><dd className="mt-1 whitespace-pre-wrap leading-relaxed">{invitation.body}</dd></div>
      </dl>
    </section>
    <section className="glass max-w-3xl p-5">
      <h2 className="font-display text-xl">Tanggapan resmi calon K/L</h2>
      <div className="mt-4 grid gap-4">
        <Field label="Email dinas untuk balasan"><input className={field} type="email" value={invitation.partnerEmail} readOnly /></Field>
        <Field label="Nama pejabat penandatangan"><input className={field} value={signerName} onChange={(event) => setSignerName(event.target.value)} autoComplete="name" /></Field>
        <Field label="Jabatan"><input className={field} value={signerTitle} onChange={(event) => setSignerTitle(event.target.value)} /></Field>
        <Field label="Keputusan"><select className={field} value={decision} onChange={(event) => { const next = event.target.value as "setuju" | "tolak"; setDecision(next); setStatement(next === "setuju" ? `Kami menyetujui surat rekomendasi TPOA nomor ${invitation.number} perihal ${invitation.subject} untuk kerja sama ${invitation.orgName}.` : "") }}><option value="setuju">Menyetujui</option><option value="tolak">Menolak</option></select></Field>
        <Field label={decision === "setuju" ? "Isi surat persetujuan" : "Alasan penolakan"} wide><textarea className={field} rows={7} value={statement} onChange={(event) => setStatement(event.target.value)} /></Field>
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <button type="button" disabled={!canSubmit} onClick={sendToTpoa} className="rounded-md bg-forest-deep px-5 py-2.5 text-[14px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">Kirim persetujuan ke TPOA</button>
        <button type="button" onClick={() => window.print()} className="rounded-md border border-primary/35 px-5 py-2.5 text-[14px] font-semibold text-primary">Cetak surat persetujuan</button>
      </div>
    </section>
    <div id="print-area" className="print-only" style={{ fontFamily: "Georgia, serif", color: "#000" }}>
      <header style={{ textAlign: "center", borderBottom: "2px solid #000", paddingBottom: 8, marginBottom: 20 }}><strong>{invitation.partnerName}</strong><div>Surat Persetujuan Calon K/L Mitra</div></header>
      <p>Nomor surat TPOA: {invitation.number}</p><p>Perihal: {invitation.subject}</p>
      <p style={{ marginTop: 24, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{statement}</p>
      <p style={{ marginTop: 28 }}>Hormat kami,</p><p style={{ marginTop: 44 }}>{signerName || "[Nama pejabat]"}<br />{signerTitle || "[Jabatan]"}<br />{invitation.partnerName}</p>
    </div>
  </div>
}

function PartnerApprovalInbox({ incomingSubmission }: { incomingSubmission: PartnerSubmission | null }) {
  const [orgId, setOrgId] = useLocal("tpoa:active-ingo", initialOrgs[0].id)
  const currentOrgId = incomingSubmission?.orgId ?? orgId
  const org = initialOrgs.find((item) => item.id === currentOrgId) ?? initialOrgs[0]
  const approval = usePartnerApprovalFile(org.id)
  const [record, setRecord] = useLocal<PartnerApprovalRecord>(`tpoa:partner-approval-record:${org.id}`, incomingSubmission ? { senderEmail: incomingSubmission.partnerEmail, verifiedByTpoa: false } : { senderEmail: "", verifiedByTpoa: false })
  const [submission, setSubmission] = useLocal<PartnerSubmission | null>(`tpoa:partner-submission:${org.id}`, incomingSubmission)
  useEffect(() => {
    if (!incomingSubmission) return
    writeLS(`tpoa:partner-submission:${incomingSubmission.orgId}`, incomingSubmission)
    writeLS(`tpoa:active-ingo`, incomingSubmission.orgId)
    writeLS(`tpoa:partner-approval-record:${incomingSubmission.orgId}`, { senderEmail: incomingSubmission.partnerEmail, verifiedByTpoa: false })
    setSubmission(incomingSubmission)
    setRecord({ senderEmail: incomingSubmission.partnerEmail, verifiedByTpoa: false })
    setOrgId(incomingSubmission.orgId)
  }, [incomingSubmission?.invitationId, incomingSubmission?.submittedAt])
  const confirmed = Boolean(approval.file && submission?.decision === "setuju" && record.senderEmail.includes("@") && record.verifiedByTpoa)
  const receive = async (file: File | undefined) => {
    if (await approval.receive(file)) setRecord((current) => ({ ...current, verifiedByTpoa: false }))
  }
  return <div>
    <header className="mb-6 border-b border-slate-300/70 pb-5">
      <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-forest-deep">Surat Masuk · Calon K/L Mitra</div>
      <h1 className="mt-2 font-display text-[32px] leading-tight">Persetujuan Calon K/L</h1>
      <p className="mt-2 text-[13px] text-muted">Arsip balasan terpisah dari surat rekomendasi yang dibuat dan dikirim TPOA.</p>
    </header>
    <div className="mb-5 max-w-xl"><Field label="Pilih INGO"><select className={field} value={org.id} onChange={(event) => setOrgId(event.target.value)}>{initialOrgs.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field></div>
    <section className="glass max-w-3xl p-5">
      <h2 className="font-display text-xl">Balasan calon K/L dari formulir tautan</h2>
      <p className="mt-2 text-[13px] leading-relaxed text-muted">Hasil formulir dari link muncul di sini otomatis pada browser yang sama. Unggah PDF bertanda tangan untuk arsip; verifikasi pengirim tetap dilakukan petugas.</p>
      <div className="mt-4 grid gap-4">
        <Field label="Alamat email pengirim K/L"><input className={field} type="email" value={record.senderEmail} onChange={(event) => setRecord((current) => ({ ...current, senderEmail: event.target.value, verifiedByTpoa: false }))} placeholder="nama@kementerian.go.id" /></Field>
        <Field label="Lampiran PDF persetujuan"><input className={field} type="file" accept="application/pdf,.pdf" onChange={(event) => { void receive(event.target.files?.[0]); event.target.value = "" }} /></Field>
      </div>
      {submission && <div className="mt-4 rounded-md border border-primary/25 bg-primary-light/40 p-4">
        <div className="font-semibold">Balasan formulir diterima · {submission.decision === "setuju" ? "Menyetujui" : "Menolak"}</div>
        <p className="mt-1 text-[12px] text-muted">{submission.partnerName} · {submission.signerName}, {submission.signerTitle} · {new Date(submission.submittedAt).toLocaleString("id-ID")}</p>
        <p className="mt-3 whitespace-pre-wrap text-[13px] leading-relaxed">{submission.statement}</p>
        <button type="button" onClick={() => window.print()} className="mt-3 rounded-md border border-primary/35 px-4 py-2 text-[13px] font-semibold text-primary">Cetak hasil persetujuan</button>
      </div>}
      {submission && <div id="print-area" className="print-only" style={{ fontFamily: "Georgia, serif", color: "#000" }}>
        <header style={{ textAlign: "center", borderBottom: "2px solid #000", paddingBottom: 8, marginBottom: 20 }}><strong>{submission.partnerName}</strong><div>Surat Persetujuan Calon K/L Mitra</div></header>
        <p>Organisasi: {submission.orgName}</p><p>Nomor surat rekomendasi TPOA: {submission.recommendationNumber}</p><p>Perihal: {submission.recommendationSubject}</p>
        <p>Keputusan: {submission.decision === "setuju" ? "Menyetujui" : "Menolak"}</p>
        <p style={{ marginTop: 24, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{submission.statement}</p>
        <p style={{ marginTop: 28 }}>Hormat kami,</p><p style={{ marginTop: 44 }}>{submission.signerName}<br />{submission.signerTitle}<br />{submission.partnerName}</p>
        <p style={{ marginTop: 24, fontSize: 11 }}>Dikirim dari: {submission.partnerEmail} · {new Date(submission.submittedAt).toLocaleString("id-ID")}</p>
      </div>}
      {approval.file && <div className={`mt-4 rounded-md border p-4 ${confirmed ? "border-forest/40 bg-forest-soft" : "border-ochre/50 bg-ochre-soft"}`}>
        <div className="font-semibold">{submission?.decision === "tolak" ? "Balasan menyatakan penolakan · izin prinsip terkunci" : confirmed ? "Persetujuan terverifikasi" : "PDF diterima · menunggu pemeriksaan pengirim"}</div>
        <div className="mt-1 break-all text-[13px]">{approval.file.name} · {new Date(approval.file.updatedAt).toLocaleString("id-ID")}</div>
        <div className="mt-2 flex flex-wrap gap-4"><button type="button" className="font-semibold text-primary underline" onClick={() => void downloadDeviceFile(approval.file!)}>Unduh PDF ke perangkat</button><button type="button" className="font-semibold text-primary underline" onClick={approval.open}>Buka / cetak hasil persetujuan</button></div>
      </div>}
      {approval.message && <p role="status" className="mt-3 text-[12px] text-amber-800">{approval.message}</p>}
      {approval.file && <label className="mt-4 flex items-start gap-3 text-[13px] leading-relaxed"><input className="mt-1" type="checkbox" checked={record.verifiedByTpoa} onChange={(event) => setRecord((current) => ({ ...current, verifiedByTpoa: event.target.checked }))} /><span>Saya telah mencocokkan alamat pengirim dengan email resmi calon K/L dan memeriksa dokumen persetujuannya.</span></label>}
      {!record.senderEmail.includes("@") && <p className="mt-2 text-[12px] text-amber-800">Isi alamat pengirim sebelum menandai persetujuan terverifikasi.</p>}
      <p className="mt-4 border-t border-slate-300/70 pt-3 text-[12px] text-muted">Mode uji coba: pengiriman langsung bekerja pada browser/perangkat yang sama. Untuk perangkat berbeda diperlukan backend bersama. Petugas tetap harus memeriksa identitas K/L sebelum mengesahkan balasan.</p>
    </section>
    <div className="mt-5 flex flex-wrap gap-4"><a href="#/surat/rekomendasi-kl" className="font-semibold text-primary underline underline-offset-4">Kembali ke surat rekomendasi TPOA</a><a href="#/surat/izin-prinsip-sementara" className="font-semibold text-primary underline underline-offset-4">Buka izin prinsip sementara</a></div>
  </div>
}

function LetterDraft({ letterType, orgId, setOrgId }: { letterType: LetterType; orgId: string; setOrgId: (id: string) => void }) {
  const org = initialOrgs.find((item) => item.id === orgId) ?? initialOrgs[0]
  const template = templates[letterType]
  const [decision] = useLocal<Decision>(`tpoa:ingo-decision:${org.id}`, null)
  const partnerApproval = usePartnerApprovalFile(org.id)
  const [partnerApprovalRecord] = useLocal<PartnerApprovalRecord>(`tpoa:partner-approval-record:${org.id}`, { senderEmail: "", verifiedByTpoa: false })
  const [partnerSubmission] = useLocal<PartnerSubmission | null>(`tpoa:partner-submission:${org.id}`, null)
  const [partnerEmail, setPartnerEmail] = useLocal(`tpoa:partner-email:${org.id}`, "")
  const [invitation, setInvitation] = useLocal<RecommendationInvitation | null>(`tpoa:partner-invitation:${org.id}`, null)
  const [temporaryPermitIssued, setTemporaryPermitIssued] = useLocal(`tpoa:temporary-permit:${org.id}`, false)
  const [mspSigned, setMspSigned] = useLocal(`tpoa:msp-signed:${org.id}`, false)
  const approved = decision?.result === "setuju"
  const partnerAccepted = partnerApproval.file !== null && partnerSubmission?.decision === "setuju" && partnerApprovalRecord.senderEmail.includes("@") && partnerApprovalRecord.verifiedByTpoa
  const readyForTemporaryPermit = approved && partnerAccepted
  const allowed = letterType === "rekomendasi-kl"
    ? approved
    : letterType === "izin-prinsip-sementara"
      ? readyForTemporaryPermit
      : letterType === "rekomendasi-msp"
        ? approved && partnerAccepted && temporaryPermitIssued
        : approved && partnerAccepted && temporaryPermitIssued && mspSigned
  const bodyDefault = template.body.replace("[nama INGO]", org.name).replace("[calon K/L mitra]", decision?.recipient ?? org.kl)
  const [draft, setDraft] = useLocal(`tpoa:letter:${org.id}:${letterType}`, {
    recipient: `Yth. ${decision?.recipient ?? org.kl}`,
    number: "B-____/TPOA/____/2026",
    subject: template.subject,
    body: bodyDefault,
  })
  const [annex, setAnnex] = useLocal(`tpoa:tpoa-annex:${org.id}`, `LAMPIRAN TPOA\n\nNama INGO: ${org.name}\nCalon K/L mitra: ${decision?.recipient ?? org.kl}\nNomor surat: [isi nomor]\nMasa berlaku: [isi masa berlaku]\n\nPersetujuan ini berlaku sesuai ketentuan TPOA.`)
  const [saved, setSaved] = useState(false)
  const approvalMailSubject = `Permohonan persetujuan kerja sama ${org.name}`
  const invitationLink = invitation ? publicPortalLink(`invitation=${encodeURIComponent(encodePortalPayload(invitation))}`) : ""
  const sendInvitation = () => {
    if (!partnerEmail.includes("@")) return
    const nextInvitation: RecommendationInvitation = {
      id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
      orgId: org.id,
      orgName: org.name,
      partnerEmail,
      partnerName: decision?.recipient ?? org.kl,
      number: draft.number,
      subject: draft.subject,
      body: draft.body,
      issuedAt: Date.now(),
    }
    setInvitation(nextInvitation)
    const directLink = publicPortalLink(`invitation=${encodeURIComponent(encodePortalPayload(nextInvitation))}`)
    const mailBody = `Yth. ${nextInvitation.partnerName},\n\nTPOA menyampaikan surat rekomendasi ${nextInvitation.orgName} dengan nomor ${nextInvitation.number}. Silakan buka tautan khusus berikut untuk membaca surat dan mengisi persetujuan dari tim K/L Anda:\n\n${directLink}\n\nSetelah formulir dikirim, aplikasi email akan menyiapkan balasan untuk reg.ingo@kemlu.go.id.\n\nHormat kami,\nTim Penilai Organisasi Asing (TPOA)\nKementerian Luar Negeri Republik Indonesia`
    window.location.href = `mailto:${partnerEmail}?subject=${encodeURIComponent(approvalMailSubject)}&body=${encodeURIComponent(mailBody)}`
  }
  const update = (key: keyof typeof draft, value: string) => {
    setDraft((current) => ({ ...current, [key]: value }))
    setSaved(false)
  }
  return <div>
    <header className="mb-8 border-b border-slate-300/70 pb-7">
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-forest-deep">Dokumen · TPOA</div>
      <h1 className="mt-3 font-display text-[36px] leading-tight text-ink max-[700px]:text-[29px]">{template.title}</h1>
      <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-muted">Pilih INGO untuk membuka template yang sesuai tahap persetujuannya. Draft tersimpan di browser ini.</p>
      <div className="mt-5 max-w-md"><Field label="Pilih INGO"><select className={field} value={org.id} onChange={(event) => setOrgId(event.target.value)}>{initialOrgs.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field></div>
    </header>
    {letterType === "rekomendasi-kl" && <section className="mb-5 rounded-md border-l-4 border-primary bg-primary-light/50 p-4">
      <h2 className="font-display text-lg">Dokumen TPOA kepada calon mitra</h2>
      <p className="mt-1 text-[12px] text-muted">Isi surat ini disusun oleh TPOA. Surat balasan/persetujuan dari K/L adalah dokumen terpisah.</p>
      <p className="mt-2 text-[12px] text-amber-800">Tautan demo memuat isi surat dan membuka aplikasi email perangkat. Jangan kirim data rahasia melalui prototipe ini.</p>
      <a href="#/surat/persetujuan-kl" className="mt-2 inline-block font-semibold text-primary underline underline-offset-4">Buka penerimaan surat persetujuan calon K/L</a>
    </section>}
    {letterType === "izin-prinsip-sementara" && <section className={`mb-5 rounded-md border-l-4 p-4 ${partnerAccepted ? "border-forest bg-forest-soft" : "border-ochre bg-ochre-soft"}`}>
      <h2 className="font-display text-lg">Lampiran surat persetujuan calon K/L</h2>
      {partnerApproval.file ? <>
        <p className="mt-1 text-[13px] font-semibold text-forest-deep">Diterima: {partnerApproval.file.name}</p>
        <p className="mt-1 text-[12px] text-muted">Status otomatis diperbarui · {new Date(partnerApproval.file.updatedAt).toLocaleString("id-ID")}</p>
        <div className="mt-2 flex flex-wrap gap-4"><button type="button" className="font-semibold text-primary underline" onClick={() => void downloadDeviceFile(partnerApproval.file!)}>Unduh PDF</button><button type="button" className="font-semibold text-primary underline" onClick={partnerApproval.open}>Buka / cetak PDF</button></div>
      </> : <p className="mt-1 text-[13px] text-amber-800">Izin prinsip menunggu PDF persetujuan calon K/L.</p>}
      {partnerApproval.message && <p role="status" className="mt-2 text-[12px] text-amber-800">{partnerApproval.message}</p>}
      <a href="#/surat/persetujuan-kl" className="mt-3 inline-block font-semibold text-primary underline underline-offset-4">Kelola dokumen persetujuan masuk</a>
    </section>}
    {!allowed ? <section className="glass p-6" role="status">
      <h2 className="font-display text-xl">Surat menunggu persetujuan</h2>
      <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-muted">{!approved ? "Keputusan Pertimbangan TPOA harus Setuju terlebih dahulu." : letterType === "izin-prinsip-sementara" && !partnerApproval.file ? "Unggah dan verifikasi PDF surat persetujuan resmi dari calon K/L mitra untuk menerbitkan izin prinsip sementara." : letterType === "izin-prinsip-sementara" && !partnerAccepted ? "Verifikasi email pengirim calon K/L pada halaman Persetujuan Calon K/L." : letterType === "izin-prinsip-tetap" && !mspSigned ? "MSP harus ditandatangani sebelum izin prinsip tetap diterbitkan." : letterType === "rekomendasi-msp" && !temporaryPermitIssued ? "Surat izin prinsip sementara perlu disimpan terlebih dahulu." : "Surat tersedia setelah persetujuan calon K/L diterima."}</p>
      <a href="#/registrasi-ingo/pertimbangan" className="mt-4 inline-block font-semibold text-primary underline underline-offset-4">Buka Pertimbangan TPOA</a>
    </section> : <>
      <section className="glass grid grid-cols-2 gap-x-5 gap-y-5 p-6 max-[700px]:grid-cols-1 max-[700px]:p-4">
        <Field label="Penerima"><input className={field} value={draft.recipient} onChange={(event) => update("recipient", event.target.value)} /></Field>
        {letterType === "rekomendasi-kl" && <Field label="Email resmi calon K/L mitra"><input className={field} type="email" value={partnerEmail} onChange={(event) => setPartnerEmail(event.target.value)} placeholder="alamat@kementerian.go.id" /></Field>}
        <Field label="Nomor surat"><input className={field} value={draft.number} onChange={(event) => update("number", event.target.value)} /></Field>
        <Field label="Perihal" wide><input className={field} value={draft.subject} onChange={(event) => update("subject", event.target.value)} /></Field>
        <Field label="Isi surat" wide><textarea className={field} rows={14} value={draft.body} onChange={(event) => update("body", event.target.value)} /></Field>
        {letterType === "izin-prinsip-sementara" && <Field label="Lampiran TPOA (template)" wide><textarea className={field} rows={6} value={annex} onChange={(event) => setAnnex(event.target.value)} /></Field>}
        {letterType === "rekomendasi-msp" && <label className="col-span-2 flex items-center gap-3 rounded-md border border-slate-300/70 bg-white/40 p-3 text-[13px] max-[700px]:col-span-1"><input type="checkbox" checked={mspSigned} onChange={(event) => setMspSigned(event.target.checked)} /> MSP telah ditandatangani kedua pihak</label>}
        <div className="col-span-2 flex flex-wrap items-center gap-3 max-[700px]:col-span-1">
          <button type="button" onClick={() => { setSaved(true); if (letterType === "izin-prinsip-sementara") setTemporaryPermitIssued(true) }} className="rounded-md bg-forest-deep px-5 py-2.5 text-[14px] font-semibold text-white cursor-pointer">Simpan surat</button>
          <button type="button" onClick={() => window.print()} className="rounded-md border border-primary/35 px-5 py-2.5 text-[14px] font-semibold text-primary cursor-pointer">Cetak A4</button>
          <button type="button" onClick={() => downloadTextFile(`${template.title}-${org.name}.txt`, `${template.title}\n${draft.number}\n\nKepada: ${draft.recipient}\nPerihal: ${draft.subject}\n\n${draft.body}${letterType === "izin-prinsip-sementara" && partnerApproval.file ? `\n\nLampiran persetujuan mitra: ${partnerApproval.file.name}` : ""}`)} className="rounded-md border border-slate-300/70 px-5 py-2.5 text-[14px] font-semibold text-ink">Unduh salinan ke perangkat</button>
          {letterType === "rekomendasi-kl" && <button type="button" disabled={!partnerEmail.includes("@")} onClick={sendInvitation} className="rounded-md border border-primary/35 px-5 py-2.5 text-[14px] font-semibold text-primary disabled:cursor-not-allowed disabled:opacity-50">Siapkan email tautan persetujuan</button>}
          {saved && <span role="status" className="text-[13px] text-forest-deep">Draft tersimpan di browser ini.</span>}
        </div>
        {letterType === "rekomendasi-kl" && invitationLink && <div className="col-span-2 break-all border-t border-slate-300/70 pt-3 text-[12px] text-muted max-[700px]:col-span-1">Tautan khusus formulir K/L: <a href={invitationLink} target="_blank" rel="noreferrer" className="font-semibold text-primary underline">Buka formulir mitra</a><div className="mt-1">{invitationLink}</div></div>}
      </section>
      <div id="print-area" className="print-only" style={{ fontFamily: "Georgia, serif", color: "#000" }}>
        <div style={{ textAlign: "center", borderBottom: "2px solid #000", paddingBottom: 8, marginBottom: 16 }}>
          <strong>KEMENTERIAN LUAR NEGERI REPUBLIK INDONESIA</strong><div>Tim Penilai Organisasi Asing (TPOA)</div>
        </div>
        <div style={{ textAlign: "right" }}>Nomor: {draft.number}</div>
        <p>{draft.recipient}</p><p>Perihal: {draft.subject}</p>
        <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", marginTop: 16, lineHeight: 1.6 }}>{draft.body}</pre>
        {letterType === "izin-prinsip-sementara" && <><div style={{ pageBreakBefore: "always" }} /><pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", lineHeight: 1.6 }}>{annex}</pre><p>Lampiran PDF persetujuan calon K/L mitra: {partnerApproval.file?.name ?? "Belum dipilih"}</p></>}
      </div>
    </>}
    <div className="mt-6"><a href="#/" className="rounded-md border border-primary/35 bg-white/50 px-5 py-2.5 text-[14px] font-semibold text-primary">Kembali ke menu utama</a></div>
  </div>
}