import { useEffect, useState } from "react"
import { initialOrgs } from "./IngoDashboard"
import { Field, field } from "./Ingo"
import { downloadDeviceFile, readDeviceFile, saveDeviceFile, useLocal, type StoredLocalFile } from "./store"

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

function downloadTextFile(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }))
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 60000)
}

export function LetterEditorPage({ letterType }: { letterType: LetterType }) {
  const [orgId, setOrgId] = useLocal("tpoa:active-ingo", initialOrgs[0].id)
  return <LetterDraft key={`${letterType}:${orgId}`} letterType={letterType} orgId={orgId} setOrgId={setOrgId} />
}

function LetterDraft({ letterType, orgId, setOrgId }: { letterType: LetterType; orgId: string; setOrgId: (id: string) => void }) {
  const org = initialOrgs.find((item) => item.id === orgId) ?? initialOrgs[0]
  const template = templates[letterType]
  const [decision] = useLocal<Decision>(`tpoa:ingo-decision:${org.id}`, null)
  const approvalFileKey = `tpoa:partner-approval-file:${org.id}`
  const [partnerApprovalFile, setPartnerApprovalFile] = useState<StoredLocalFile | null>(null)
  const [fileMessage, setFileMessage] = useState("")
  const [partnerEmail, setPartnerEmail] = useLocal(`tpoa:partner-email:${org.id}`, "")
  const [temporaryPermitIssued, setTemporaryPermitIssued] = useLocal(`tpoa:temporary-permit:${org.id}`, false)
  const [mspSigned, setMspSigned] = useLocal(`tpoa:msp-signed:${org.id}`, false)
  useEffect(() => {
    let active = true
    readDeviceFile(approvalFileKey).then((file) => { if (active) setPartnerApprovalFile(file) }).catch(() => { if (active) setFileMessage("Penyimpanan berkas tidak dapat dibuka di browser ini.") })
    return () => { active = false }
  }, [approvalFileKey])
  const approved = decision?.result === "setuju"
  const partnerAccepted = partnerApprovalFile !== null
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
  const approvalMailBody = `Yth. ${decision?.recipient ?? org.kl},\n\nBersama email ini TPOA menyampaikan surat rekomendasi kerja sama untuk ${org.name}. Mohon meninjau dan mengirim kembali surat persetujuan resmi yang telah ditandatangani sebagai lampiran PDF dengan membalas email ini.\n\nNomor: ${draft.number}\nPerihal: ${draft.subject}\n\n${draft.body}\n\nHormat kami,\nTim Penilai Organisasi Asing (TPOA)\nKementerian Luar Negeri Republik Indonesia`
  const approvalMailHref = `mailto:${partnerEmail}?subject=${encodeURIComponent(approvalMailSubject)}&body=${encodeURIComponent(approvalMailBody)}`
  const update = (key: keyof typeof draft, value: string) => {
    setDraft((current) => ({ ...current, [key]: value }))
    setSaved(false)
  }
  const receivePartnerApproval = async (file: File | undefined) => {
    if (!file) return
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setFileMessage("Lampiran persetujuan harus berupa PDF.")
      return
    }
    if (file.size > 15 * 1024 * 1024) {
      setFileMessage("Ukuran PDF maksimal 15 MB.")
      return
    }
    try {
      await saveDeviceFile(approvalFileKey, file)
      const stored = await readDeviceFile(approvalFileKey)
      setPartnerApprovalFile(stored)
      setFileMessage(stored ? `Surat persetujuan diterima dan disimpan di perangkat ini pada ${new Date(stored.updatedAt).toLocaleString("id-ID").replace(/\\./g, ":")}.` : "Berkas belum dapat dibaca kembali.")
    } catch {
      setFileMessage("PDF tidak dapat disimpan. Periksa ruang penyimpanan browser lalu coba lagi.")
    }
  }
  const openPartnerApproval = () => {
    if (!partnerApprovalFile) return
    const url = URL.createObjectURL(partnerApprovalFile.blob)
    window.open(url, "_blank", "noopener,noreferrer")
    window.setTimeout(() => URL.revokeObjectURL(url), 60000)
  }
  return <div>
    <header className="mb-8 border-b border-slate-300/70 pb-7">
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-forest-deep">Dokumen · TPOA</div>
      <h1 className="mt-3 font-display text-[36px] leading-tight text-ink max-[700px]:text-[29px]">{template.title}</h1>
      <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-muted">Pilih INGO untuk membuka template yang sesuai tahap persetujuannya. Draft tersimpan di browser ini.</p>
      <div className="mt-5 max-w-md"><Field label="Pilih INGO"><select className={field} value={org.id} onChange={(event) => setOrgId(event.target.value)}>{initialOrgs.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field></div>
    </header>
    {(letterType === "izin-prinsip-sementara" || letterType === "rekomendasi-kl") && <section className={`mb-5 rounded-md border-l-4 p-4 ${partnerAccepted ? "border-forest bg-forest-soft" : "border-ochre bg-ochre-soft"}`}>
      <h2 className="font-display text-lg">{letterType === "rekomendasi-kl" ? "Balasan persetujuan calon K/L" : "Dokumen persetujuan calon K/L"}</h2>
      <p className="mb-3 mt-1 text-[12px] text-muted">Setelah mitra membalas email dengan surat bertanda tangan, petugas TPOA unggah PDF di sini. Berkas tersimpan lokal di perangkat ini.</p>
      <div className="grid grid-cols-2 gap-4 max-[700px]:grid-cols-1">
        <Field label="Surat persetujuan resmi dari calon K/L mitra"><input className={field} type="file" accept="application/pdf,.pdf" onChange={(event) => { void receivePartnerApproval(event.target.files?.[0]); event.target.value = "" }} /></Field>
        <div className="self-end text-[13px]">{partnerApprovalFile ? <><strong className="text-forest-deep">Diterima · {partnerApprovalFile.name}</strong><div className="mt-1 flex flex-wrap gap-3"><button type="button" className="font-semibold text-primary underline" onClick={() => void downloadDeviceFile(partnerApprovalFile)}>Unduh ke perangkat</button><button type="button" className="font-semibold text-primary underline" onClick={openPartnerApproval}>Buka / cetak PDF</button></div></> : <span className="text-muted">Belum ada lampiran persetujuan.</span>}</div>
      </div>
      {fileMessage && <p role="status" className="mt-2 text-[12px] text-amber-800">{fileMessage}</p>}
      <p className="mt-3 text-[12px] text-muted">Lampiran disimpan lokal pada perangkat/browser ini. Balasan email dari mitra tetap perlu diunggah oleh petugas TPOA.</p>
    </section>}
    {!allowed ? <section className="glass p-6" role="status">
      <h2 className="font-display text-xl">Surat menunggu persetujuan</h2>
      <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-muted">{!approved ? "Keputusan Pertimbangan TPOA harus Setuju terlebih dahulu." : letterType === "izin-prinsip-sementara" && !partnerApprovalFile ? "Unggah PDF surat persetujuan resmi dari calon K/L mitra untuk menerbitkan izin prinsip sementara." : letterType === "izin-prinsip-tetap" && !mspSigned ? "MSP harus ditandatangani sebelum izin prinsip tetap diterbitkan." : letterType === "rekomendasi-msp" && !temporaryPermitIssued ? "Surat izin prinsip sementara perlu disimpan terlebih dahulu." : "Surat tersedia setelah persetujuan calon K/L mitra diterima."}</p>
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
          <button type="button" onClick={() => downloadTextFile(`${template.title}-${org.name}.txt`, `${template.title}\n${draft.number}\n\nKepada: ${draft.recipient}\nPerihal: ${draft.subject}\n\n${draft.body}${letterType === "izin-prinsip-sementara" && partnerApprovalFile ? `\n\nLampiran persetujuan mitra: ${partnerApprovalFile.name}` : ""}`)} className="rounded-md border border-slate-300/70 px-5 py-2.5 text-[14px] font-semibold text-ink">Unduh salinan ke perangkat</button>
          {letterType === "rekomendasi-kl" && <a href={approvalMailHref} aria-disabled={!partnerEmail.includes("@")} onClick={(event) => { if (!partnerEmail.includes("@")) event.preventDefault() }} className={`rounded-md border border-primary/35 px-5 py-2.5 text-[14px] font-semibold ${partnerEmail.includes("@") ? "text-primary" : "cursor-not-allowed text-muted opacity-50"}`}>Buka email resmi ke calon K/L</a>}
          {saved && <span role="status" className="text-[13px] text-forest-deep">Draft tersimpan di browser ini.</span>}
        </div>
      </section>
      <div id="print-area" className="print-only" style={{ fontFamily: "Georgia, serif", color: "#000" }}>
        <div style={{ textAlign: "center", borderBottom: "2px solid #000", paddingBottom: 8, marginBottom: 16 }}>
          <strong>KEMENTERIAN LUAR NEGERI REPUBLIK INDONESIA</strong><div>Tim Penilai Organisasi Asing (TPOA)</div>
        </div>
        <div style={{ textAlign: "right" }}>Nomor: {draft.number}</div>
        <p>{draft.recipient}</p><p>Perihal: {draft.subject}</p>
        <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", marginTop: 16, lineHeight: 1.6 }}>{draft.body}</pre>
        {letterType === "izin-prinsip-sementara" && <><div style={{ pageBreakBefore: "always" }} /><pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", lineHeight: 1.6 }}>{annex}</pre><p>Lampiran PDF persetujuan calon K/L mitra: {partnerApprovalFile?.name ?? "Belum dipilih"}</p></>}
      </div>
    </>}
    <div className="mt-6"><a href="#/" className="rounded-md border border-primary/35 bg-white/50 px-5 py-2.5 text-[14px] font-semibold text-primary">Kembali ke menu utama</a></div>
  </div>
}