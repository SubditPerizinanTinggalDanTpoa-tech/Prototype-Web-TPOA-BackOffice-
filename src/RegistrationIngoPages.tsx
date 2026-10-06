import { useEffect, useState } from "react"
import { initialOrgs } from "./IngoDashboard"
import { docs, Field, field, type Org } from "./Ingo"
import { addLog, useLocal } from "./store"

type RegistrationForm = {
  name: string
  country: string
  partner: string
  field: string
  funding: string
  msp: string
  address: string
  contactNumber: string
  contactEmail: string
  operatingSince: string
}

type PersonnelRow = { id: number; name: string; role: string; country: string; email: string }
type Decision = { result: "setuju" | "tolak"; recipient: string; statement: string; updatedAt: number } | null

const stages = [
  { key: "permohonan", name: "Permohonan registrasi" },
  { key: "verifikasi", name: "Verifikasi berlapis" },
  { key: "pertimbangan", name: "Pertimbangan TPOA" },
] as const

type ApprovalFlow = {
  chairEmail: string
  invitationToken: string
  invitationExpiresAt: number
  invitationTimes: number[]
  chairStatus: "belum" | "menunggu" | "disetujui" | "ditolak"
  chairAt: number | null
  chairNote: string
  chairReviewedDocs: number[]
  layer1Approved: boolean
  layer1At: number | null
  usedTokens: string[]
}

const initialApprovalFlow: ApprovalFlow = {
  chairEmail: "ketua.tpoa@kemlu.go.id",
  invitationToken: "",
  invitationExpiresAt: 0,
  invitationTimes: [],
  chairStatus: "belum",
  chairAt: null,
  chairNote: "",
  chairReviewedDocs: [],
  layer1Approved: false,
  layer1At: null,
  usedTokens: [],
}

const approvalStorageKey = (orgId: string) => `tpoa:verification-flow:v2:${orgId}`
const invitationLifetime = 24 * 60 * 60 * 1000
const resendCooldown = 60 * 1000
const maxInvitationsPerDay = 3

function createToken() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function chairApprovalUrl(orgId: string, token: string, documentIndex?: number) {
  const documentQuery = documentIndex === undefined ? "" : `&document=${documentIndex}`
  const appUrl = import.meta.env.VITE_PUBLIC_APP_URL || `${window.location.origin}${window.location.pathname}`
  return `${appUrl}#/registrasi-ingo/persetujuan-ketua?org=${encodeURIComponent(orgId)}&token=${encodeURIComponent(token)}${documentQuery}`
}

export type RegistrationStage = (typeof stages)[number]["key"]

function PageTitle({ title, org }: { title: string; org: Org }) {
  return <header className="mb-6 border-b border-slate-300/70 pb-5">
    <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-forest-deep">Pendaftaran INGO · {org.name}</div>
    <h1 className="mt-2 font-display text-[32px] leading-tight text-ink max-[700px]:text-[27px]">{title}</h1>
  </header>
}

function RegistrationStepNav({ active }: { active: RegistrationStage }) {
  return <nav aria-label="Tahapan registrasi INGO" className="mb-6 flex overflow-x-auto border-b border-slate-300/70">
    {stages.map((stage, index) => <a key={stage.key} href={`#/registrasi-ingo/${stage.key}`} aria-current={active === stage.key ? "page" : undefined} className={`min-w-48 flex-1 border-b-[3px] px-4 py-3 text-[13px] font-semibold transition-colors ${active === stage.key ? "border-forest text-forest-deep" : "border-transparent text-muted hover:text-ink"}`}>
      <span className="mr-2 font-mono text-[10px]">0{index + 1}</span>{stage.name}
    </a>)}
  </nav>
}

function PageReturn({ back }: { back?: { href: string; label: string } }) {
  return <div className="mt-6 flex flex-wrap gap-3">
    {back && <a href={back.href} className="rounded-md bg-linear-to-r from-primary to-forest px-5 py-2.5 text-[14px] font-semibold text-white">{back.label}</a>}
    <a href="#/" className="rounded-md border border-primary/35 bg-white/50 px-5 py-2.5 text-[14px] font-semibold text-primary">Kembali ke menu utama</a>
  </div>
}

function OrganizationSelector({ orgId, setOrgId }: { orgId: string; setOrgId: (id: string) => void }) {
  return <div className="mb-6 max-w-xl">
    <Field label="Pilih INGO"><select className={field} value={orgId} onChange={(event) => setOrgId(event.target.value)}>
      {initialOrgs.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}
    </select></Field>
  </div>
}

function RegistrationRequest({ org }: { org: Org }) {
  const storageKey = `tpoa:registration:${org.id}`
  const [form, setForm] = useLocal<RegistrationForm>(storageKey, {
    name: org.name,
    country: org.country,
    partner: org.kl,
    field: org.field,
    funding: "FCR",
    msp: org.msp,
    address: org.id === "cf" ? "Jl. Wijaya I No. 18, Jakarta Selatan" : "",
    contactNumber: org.id === "cf" ? "0812-0000-0001" : "",
    contactEmail: org.id === "cf" ? "indonesia@childfund.example" : "",
    operatingSince: org.id === "cf" ? "1998" : "",
  })
  const [saved, setSaved] = useState(false)
  const update = (key: keyof RegistrationForm, value: string) => {
    setForm((current) => ({ ...current, [key]: value }))
    setSaved(false)
  }
  const fields: [keyof RegistrationForm, string][] = [
    ["name", "Nama INGO"], ["country", "Negara asal"], ["partner", "K/L mitra"], ["field", "Bidang"],
    ["funding", "Komponen pendanaan (IDR/FCR)"], ["msp", "Masa berlaku MSP"], ["address", "Alamat kantor"],
    ["contactNumber", "Nomor CP"], ["contactEmail", "Kontak CP"], ["operatingSince", "Tahun mulai beroperasi"],
  ]
  return <div>
    <PageTitle title="Permohonan registrasi" org={org} />
    <div className="glass p-6 max-[700px]:p-4">
      <div className="mb-5 font-mono text-[10px] uppercase tracking-[0.16em] text-forest-deep">Email masuk ke reg.ingo@kemlu.go.id</div>
      <div className="grid grid-cols-2 gap-x-5 gap-y-4 max-[700px]:grid-cols-1">
        {fields.map(([key, label]) => <Field key={key} label={label}><input className={field} value={form[key]} onChange={(event) => update(key, event.target.value)} /></Field>)}
      </div>
    </div>
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <button type="button" onClick={() => setSaved(true)} className="rounded-md bg-linear-to-r from-primary to-forest px-5 py-2.5 text-[14px] font-semibold text-white">Simpan permohonan</button>
      {saved && <span role="status" className="text-[13px] text-forest-deep">Permohonan tersimpan sementara.</span>}
    </div>
    <PageReturn back={{ href: "#/registrasi-ingo/verifikasi", label: "Lanjut ke verifikasi" }} />
  </div>
}

function PersonnelVerification({ org }: { org: Org }) {
  const documentKey = `tpoa:document-review:${org.id}`
  const [documentStatus, setDocumentStatus] = useLocal<string[]>(documentKey, docs.map(() => "Lengkap"))
  const [approval, setApproval] = useLocal<ApprovalFlow>(approvalStorageKey(org.id), initialApprovalFlow)
  const [finalizationPhrase, setFinalizationPhrase] = useState("")
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])
  const allComplete = documentStatus.length === docs.length && documentStatus.every((status) => status === "Lengkap")
  const invitationsToday = approval.invitationTimes.filter((time) => now - time < 24 * 60 * 60 * 1000)
  const cooldownLeft = approval.invitationTimes.length
    ? Math.max(0, resendCooldown - (now - approval.invitationTimes[approval.invitationTimes.length - 1]))
    : 0
  const canInvite = allComplete && approval.chairEmail.includes("@") && cooldownLeft === 0 && invitationsToday.length < maxInvitationsPerDay && approval.chairStatus !== "disetujui"
  const approvalReady = allComplete && approval.chairStatus === "disetujui" && !approval.layer1Approved
  const inviteHref = approval.invitationToken ? chairApprovalUrl(org.id, approval.invitationToken) : ""
  const mailSubject = `Persetujuan verifikasi dokumen INGO ${org.name}`
  const mailBody = approval.invitationToken
    ? `Yth. Ketua TPOA,\n\nMohon tinjau dan berikan persetujuan atas dokumen ${org.name} melalui tautan privat berikut (berlaku 24 jam dan hanya dapat digunakan satu kali):\n${inviteHref}\n\nTautan dokumen:\n${docs.map((document, index) => `${document.n}: ${chairApprovalUrl(org.id, approval.invitationToken, index)}`).join("\n")}\n\nEmail tujuan terdaftar: ${approval.chairEmail}\n\nSekretariat TPOA`
    : ""
  const mailHref = approval.invitationToken
    ? `mailto:${approval.chairEmail}?subject=${encodeURIComponent(mailSubject)}&body=${encodeURIComponent(mailBody)}`
    : ""

  const updateStatus = (index: number, value: string) => {
    setDocumentStatus((current) => current.map((status, row) => row === index ? value : status))
    setApproval({ ...initialApprovalFlow, chairEmail: approval.chairEmail })
    setFinalizationPhrase("")
  }
  const prepareInvitation = () => {
    if (!canInvite) return
    const sentAt = Date.now()
    const invitationTimes = [...invitationsToday, sentAt]
    const token = createToken()
    setApproval({
      ...approval,
      invitationToken: token,
      invitationExpiresAt: sentAt + invitationLifetime,
      invitationTimes,
      chairStatus: "menunggu",
      chairAt: null,
      chairNote: "",
      chairReviewedDocs: [],
      layer1Approved: false,
      layer1At: null,
    })
    addLog(org, "Persetujuan", `Undangan verifikasi Ketua TPOA disiapkan ke ${approval.chairEmail}`)
  }
  const finalize = () => {
    if (!approvalReady || finalizationPhrase !== "FINALISASI") return
    setApproval((current) => ({ ...current, layer1Approved: true, layer1At: Date.now() }))
    addLog(org, "Persetujuan", "Sekretariat memfinalisasi verifikasi setelah persetujuan Ketua TPOA")
  }
  return <div>
    <PageTitle title="Verifikasi berlapis" org={org} />
    <section className="mb-7">
      <h2 className="font-display text-xl">Pemeriksaan dokumen oleh Sekretariat</h2>
      <p className="mt-1 text-[13px] text-muted">Status dokumen menjadi dasar undangan privat kepada Ketua TPOA. Perubahan status membatalkan persetujuan yang sudah ada.</p>
      <div className="mt-4 overflow-x-auto rounded-lg border border-slate-300/70 bg-white/45">
        <table className="w-full min-w-[850px] text-[13px]">
          <thead><tr className="border-b border-slate-300/70 text-left font-mono text-[10px] uppercase tracking-[0.12em] text-muted"><th className="p-3 font-normal">No</th><th className="p-3 font-normal">Dokumen INGO</th><th className="p-3 font-normal">Ketentuan</th><th className="p-3 font-normal">Status Sekretariat</th><th className="p-3 font-normal">Persetujuan Ketua</th></tr></thead>
          <tbody>{docs.map((document, index) => <tr key={document.n} className="border-b border-slate-200/80 last:border-0 align-top">
            <td className="p-3 font-mono text-muted">{String(index + 1).padStart(2, "0")}</td>
            <td className="p-3"><div className="font-medium">{document.n}</div><div className="mt-1 font-mono text-[11px] text-muted">{document.f}</div></td>
            <td className="p-3 text-[12px] text-muted">{document.syarat}</td>
            <td className="p-2"><select aria-label={`Status ${document.n}`} className={field} value={documentStatus[index] ?? "Belum diperiksa"} onChange={(event) => updateStatus(index, event.target.value)}><option>Belum diperiksa</option><option>Lengkap</option><option>Tidak lengkap</option></select></td>
            <td className="p-3">{approval.chairStatus === "disetujui" ? <span className="font-semibold text-forest-deep">Disetujui</span> : approval.chairStatus === "ditolak" ? <span className="font-semibold text-vermilion">Ditolak</span> : <span className="text-muted">Menunggu Ketua</span>}</td>
          </tr>)}</tbody>
        </table>
      </div>
    </section>

    <section className="mb-5 grid grid-cols-2 gap-4 max-[700px]:grid-cols-1">
      <div className="glass p-5">
        <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">Lapis 2 · Ketua TPOA</div>
        <h2 className="mt-2 font-display text-xl">Undangan persetujuan privat</h2>
        <p className="mt-2 text-[13px] text-muted">Tautan berlaku 24 jam, satu kali, dan dibatasi maksimal 3 undangan per 24 jam. Pengiriman ulang memiliki jeda 60 detik.</p>
        <Field label="Email resmi Ketua TPOA"><input className={field} type="email" value={approval.chairEmail} disabled={approval.chairStatus === "menunggu" || approval.chairStatus === "disetujui"} onChange={(event) => setApproval((current) => ({ ...current, chairEmail: event.target.value }))} /></Field>
        <button type="button" disabled={!canInvite} onClick={prepareInvitation} className="mt-4 rounded-md bg-forest-deep px-4 py-2 text-[13px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{approval.chairStatus === "menunggu" ? "Buat tautan pengganti" : "Siapkan undangan Ketua"}</button>
        {!allComplete && <p role="status" className="mt-3 text-[12px] text-amber-700">Semua dokumen harus berstatus Lengkap sebelum undangan dibuat.</p>}
        {invitationsToday.length >= maxInvitationsPerDay && <p role="status" className="mt-3 text-[12px] text-amber-700">Batas undangan 24 jam tercapai untuk mencegah spam.</p>}
        {cooldownLeft > 0 && approval.chairStatus === "menunggu" && <p role="status" className="mt-3 text-[12px] text-muted">Undangan ulang tersedia dalam {Math.ceil(cooldownLeft / 1000)} detik.</p>}
        {approval.invitationToken && approval.chairStatus === "menunggu" && <div className="mt-4 border-t border-slate-300/70 pt-4">
          <p className="text-[13px] font-semibold">Undangan siap dikirim ke {approval.chairEmail}</p>
          <p className="mt-1 text-[12px] text-muted">Berlaku sampai {new Date(approval.invitationExpiresAt).toLocaleString("id-ID")}. Buka email resmi untuk mengirim tautan; status pengiriman email nyata belum tersedia di prototype.</p>
          <a href={mailHref} className="mt-3 inline-block font-semibold text-primary underline underline-offset-4">Buka email untuk mengirim undangan</a>
          <div className="mt-2 break-all text-[11px] text-muted">{inviteHref}</div>
        </div>}
      </div>
      <div className="glass p-5">
        <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">Lapis 1 · Sekretariat</div>
        <h2 className="mt-2 font-display text-xl">Finalisasi verifikasi</h2>
        <p className="mt-2 text-[13px] text-muted">Persetujuan Sekretariat terkunci sampai Ketua menyetujui semua dokumen. Hasil penolakan Ketua otomatis dicatat di halaman ini.</p>
        <div className="mt-4 rounded-md border border-slate-300/70 bg-white/60 p-3 text-[13px]">
          Status Ketua: <strong className={approval.chairStatus === "ditolak" ? "text-vermilion" : "text-forest-deep"}>{approval.chairStatus === "disetujui" ? "Disetujui" : approval.chairStatus === "ditolak" ? "Ditolak" : approval.chairStatus === "menunggu" ? "Menunggu persetujuan email" : "Belum diminta"}</strong>
          {approval.chairAt && <div className="mt-1 text-[11px] text-muted">Diperbarui {new Date(approval.chairAt).toLocaleString("id-ID")}</div>}
          {approval.chairNote && <div className="mt-2 text-vermilion">Catatan Ketua: {approval.chairNote}</div>}
          {approval.layer1Approved && <div className="mt-2 font-semibold text-forest-deep">Verifikasi disetujui kedua lapis.</div>}
        </div>
        {approval.chairStatus === "menunggu" && <a href={inviteHref} className="mt-3 inline-block text-[13px] font-semibold text-primary underline underline-offset-4">Buka halaman persetujuan Ketua</a>}
        {approvalReady && <div className="mt-4">
          <Field label={'Ketik "FINALISASI" untuk konfirmasi'}><input className={field} value={finalizationPhrase} onChange={(event) => setFinalizationPhrase(event.target.value)} /></Field>
          <button type="button" disabled={finalizationPhrase !== "FINALISASI"} onClick={finalize} className="mt-3 rounded-md bg-forest-deep px-4 py-2 text-[13px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">Setujui verifikasi lapis 1</button>
        </div>}
      </div>
    </section>
    {approval.layer1Approved && <a href="#/registrasi-ingo/pertimbangan" className="font-semibold text-primary underline underline-offset-4">Lanjut ke pertimbangan TPOA</a>}
    <PageReturn back={{ href: "#/registrasi-ingo/permohonan", label: "Kembali ke permohonan" }} />
  </div>
}

export function ChairApprovalPage() {
  const params = new URLSearchParams(window.location.hash.split("?")[1] ?? "")
  const orgId = params.get("org") ?? ""
  const token = params.get("token") ?? ""
  const documentIndex = Number(params.get("document"))
  const org = initialOrgs.find((item) => item.id === orgId)
  const [approval, setApproval] = useLocal<ApprovalFlow>(approvalStorageKey(orgId), initialApprovalFlow)
  const [email, setEmail] = useState(approval.chairEmail)
  const [code, setCode] = useState("")
  const [demoCode, setDemoCode] = useState("")
  const [authenticated, setAuthenticated] = useState(false)
  const [confirmation, setConfirmation] = useState("")
  const [decisionChoice, setDecisionChoice] = useState<"disetujui" | "ditolak" | null>(null)
  const [rejectionNote, setRejectionNote] = useState("")
  const invitationIsCurrent = Boolean(token && token === approval.invitationToken && Date.now() < approval.invitationExpiresAt && approval.chairStatus === "menunggu" && !approval.usedTokens.includes(token))
  const invitationWasProcessed = Boolean(token && token === approval.invitationToken && approval.usedTokens.includes(token))
  const allChairDocsReviewed = approval.chairReviewedDocs.length === docs.length

  if (!org) return <div className="glass p-6"><PageTitle title="Tautan persetujuan tidak valid" org={initialOrgs[0]} /><p className="text-[13px] text-muted">Organisasi pada tautan tidak ditemukan.</p><PageReturn back={{ href: "#/registrasi-ingo/verifikasi", label: "Kembali ke verifikasi" }} /></div>

  const requestCode = () => {
    if (!invitationIsCurrent || email.trim().toLowerCase() !== approval.chairEmail.trim().toLowerCase()) return
    setDemoCode(String(Math.floor(100000 + Math.random() * 900000)))
    setCode("")
  }
  const login = () => {
    if (code.length === 6 && code === demoCode && invitationIsCurrent) setAuthenticated(true)
  }
  const markDocumentReviewed = (index: number, checked: boolean) => {
    setApproval((current) => ({
      ...current,
      chairReviewedDocs: checked
        ? [...new Set([...current.chairReviewedDocs, index])]
        : current.chairReviewedDocs.filter((item) => item !== index),
    }))
  }
  const recordDecision = (result: "disetujui" | "ditolak") => {
    const requiredPhrase = result === "disetujui" ? "SETUJU DOKUMEN" : "TOLAK DOKUMEN"
    if (!invitationIsCurrent || !authenticated || !allChairDocsReviewed || confirmation !== requiredPhrase || (result === "ditolak" && !rejectionNote.trim())) return
    setApproval((current) => ({
      ...current,
      chairStatus: result,
      chairAt: Date.now(),
      chairNote: result === "ditolak" ? rejectionNote.trim() : "",
      usedTokens: [...current.usedTokens, token],
      layer1Approved: false,
      layer1At: null,
    }))
    addLog(org, "Persetujuan", `Ketua TPOA ${result === "disetujui" ? "menyetujui" : "menolak"} verifikasi dokumen${result === "ditolak" ? `: ${rejectionNote.trim()}` : ""}`)
  }

  return <div>
    <PageTitle title="Persetujuan privat Ketua TPOA" org={org} />
    {invitationWasProcessed ? <div className="glass p-5">
      <h2 className="font-display text-xl">Tautan sudah digunakan</h2>
      <p className="mt-2 text-[13px] text-muted">Keputusan Ketua tercatat sebagai <strong>{approval.chairStatus === "disetujui" ? "disetujui" : "ditolak"}</strong>. Tautan persetujuan hanya dapat digunakan satu kali.</p>
      <PageReturn back={{ href: "#/registrasi-ingo/verifikasi", label: "Kembali ke verifikasi" }} />
    </div> : !invitationIsCurrent ? <div className="glass p-5">
      <h2 className="font-display text-xl">Undangan tidak berlaku</h2>
      <p className="mt-2 text-[13px] text-muted">Tautan tidak ditemukan, kedaluwarsa, atau telah diganti. Minta Sekretariat membuat undangan baru.</p>
      <PageReturn back={{ href: "#/registrasi-ingo/verifikasi", label: "Kembali ke verifikasi" }} />
    </div> : <>
      <div className="mb-5 border-l-4 border-ochre bg-ochre-soft p-4 text-[12px] leading-relaxed">Prototype demonstrasi: kode email, sesi login, token, dan status disimpan di browser. Ini belum merupakan autentikasi atau pengiriman email yang aman untuk penggunaan operasional.</div>
      {!authenticated ? <section className="glass max-w-xl p-5">
        <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">Akses khusus · Ketua TPOA</div>
        <h2 className="mt-2 font-display text-xl">Masuk dengan email terdaftar</h2>
        <p className="mt-2 text-[13px] text-muted">Tautan undangan dan kode satu kali harus cocok dengan email Ketua yang terdaftar.</p>
        <div className="mt-4 grid gap-4">
          <Field label="Email Ketua TPOA"><input className={field} type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></Field>
          <button type="button" disabled={email.trim().toLowerCase() !== approval.chairEmail.trim().toLowerCase()} onClick={requestCode} className="w-fit rounded-md border border-primary/35 px-4 py-2 text-[13px] font-semibold text-primary disabled:cursor-not-allowed disabled:opacity-50">Kirim kode ke email</button>
          {demoCode && <>
            <p role="status" className="text-[12px] text-amber-700">Simulasi email terkirim. Kode demo: <strong className="font-mono">{demoCode}</strong></p>
            <Field label="Kode enam digit"><input className={field} inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} /></Field>
            <button type="button" disabled={code.length !== 6} onClick={login} className="w-fit rounded-md bg-forest-deep px-4 py-2 text-[13px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">Masuk dan tinjau dokumen</button>
          </>}
        </div>
      </section> : <>
        <section className="mb-5">
          <h2 className="font-display text-xl">Tinjau dokumen yang ditautkan</h2>
          <p className="mt-1 text-[13px] text-muted">Buka setiap tautan dokumen dan tandai setelah diperiksa. Semua dokumen wajib ditinjau sebelum keputusan aktif.</p>
          <div className="mt-4 overflow-x-auto rounded-lg border border-slate-300/70 bg-white/45">
            <table className="w-full min-w-[760px] text-[13px]">
              <thead><tr className="border-b border-slate-300/70 text-left font-mono text-[10px] uppercase tracking-[0.12em] text-muted"><th className="p-3 font-normal">Dokumen</th><th className="p-3 font-normal">Ketentuan</th><th className="p-3 font-normal">Tautan</th><th className="p-3 font-normal">Sudah diperiksa</th></tr></thead>
              <tbody>{docs.map((document, index) => <tr id={`dokumen-${index}`} key={document.n} className={`border-b border-slate-200/80 last:border-0 align-top ${documentIndex === index ? "bg-ochre-soft" : ""}`}>
                <td className="p-3"><div className="font-medium">{document.n}</div><div className="mt-1 font-mono text-[11px] text-muted">{document.f}</div></td>
                <td className="p-3 text-[12px] text-muted">{document.syarat}</td>
                <td className="p-3"><a className="font-semibold text-primary underline underline-offset-4" href={chairApprovalUrl(org.id, token, index)} target="_blank" rel="noreferrer">Buka dokumen</a></td>
                <td className="p-3"><label className="flex items-center gap-2"><input type="checkbox" checked={approval.chairReviewedDocs.includes(index)} onChange={(event) => markDocumentReviewed(index, event.target.checked)} /><span>{approval.chairReviewedDocs.includes(index) ? "Diperiksa" : "Tandai periksa"}</span></label></td>
              </tr>)}</tbody>
            </table>
          </div>
        </section>
        <section className="glass max-w-2xl p-5">
          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">Keputusan satu kali</div>
          <h2 className="mt-2 font-display text-xl">Persetujuan Ketua TPOA</h2>
          <p className="mt-2 text-[13px] text-muted">Setelah dikirim, keputusan terkunci dan tautan tidak dapat digunakan kembali. Penolakan wajib disertai alasan yang diteruskan ke Sekretariat.</p>
          {!allChairDocsReviewed && <p role="status" className="mt-3 text-[12px] text-amber-700">Dokumen diperiksa: {approval.chairReviewedDocs.length} dari {docs.length}.</p>}
          <Field label="Catatan penolakan (wajib jika menolak)"><textarea className={field} rows={3} value={rejectionNote} onChange={(event) => setRejectionNote(event.target.value)} /></Field>
          <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Pilih keputusan Ketua">
            <button type="button" aria-pressed={decisionChoice === "disetujui"} onClick={() => { setDecisionChoice("disetujui"); setConfirmation("") }} className={`rounded-md border px-3 py-2 text-[13px] font-semibold ${decisionChoice === "disetujui" ? "border-forest bg-forest-soft text-forest-deep" : "border-slate-300/70 text-muted"}`}>Setuju</button>
            <button type="button" aria-pressed={decisionChoice === "ditolak"} onClick={() => { setDecisionChoice("ditolak"); setConfirmation("") }} className={`rounded-md border px-3 py-2 text-[13px] font-semibold ${decisionChoice === "ditolak" ? "border-vermilion bg-vermilion-soft text-vermilion" : "border-slate-300/70 text-muted"}`}>Tolak</button>
          </div>
          {decisionChoice && <div className="mt-3 max-w-sm"><Field label={`Ketik "${decisionChoice === "disetujui" ? "SETUJU DOKUMEN" : "TOLAK DOKUMEN"}" untuk konfirmasi`}><input className={field} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></Field></div>}
          <div className="mt-4 flex flex-wrap gap-3">
            {decisionChoice === "disetujui" && <button type="button" disabled={!allChairDocsReviewed || confirmation !== "SETUJU DOKUMEN"} onClick={() => recordDecision("disetujui")} className="rounded-md bg-forest-deep px-4 py-2 text-[13px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">Setujui dokumen</button>}
            {decisionChoice === "ditolak" && <button type="button" disabled={!allChairDocsReviewed || confirmation !== "TOLAK DOKUMEN" || !rejectionNote.trim()} onClick={() => recordDecision("ditolak")} className="rounded-md bg-vermilion px-4 py-2 text-[13px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">Tolak dan kirim catatan</button>}
          </div>
        </section>
      </>}
      <PageReturn back={{ href: "#/registrasi-ingo/verifikasi", label: "Kembali ke halaman verifikasi" }} />
    </>}
  </div>
}

function TpoaConsideration({ org }: { org: Org }) {
  const decisionKey = `tpoa:ingo-decision:${org.id}`
  const [decision, setDecision] = useLocal<Decision>(decisionKey, null)
  const [approvals] = useLocal<ApprovalFlow>(approvalStorageKey(org.id), initialApprovalFlow)
  const canSaveDecision = approvals.chairStatus === "disetujui" && approvals.layer1Approved
  const [result, setResult] = useState<"setuju" | "tolak">(decision?.result ?? "setuju")
  const [recipient, setRecipient] = useState(decision?.recipient ?? org.kl)
  const defaultStatement = result === "setuju"
    ? `Berdasarkan hasil verifikasi dan persetujuan berjenjang, permohonan ${org.name} disetujui untuk melanjutkan kerja sama dengan ${recipient}.`
    : `Berdasarkan hasil verifikasi dan pertimbangan TPOA, permohonan ${org.name} belum dapat disetujui. Pemberitahuan ini disampaikan kepada calon K/L mitra ${recipient} untuk diketahui dan ditindaklanjuti.`
  const [statement, setStatement] = useState(decision?.statement ?? defaultStatement)
  const [saved, setSaved] = useState(false)
  const save = () => {
    setDecision({ result, recipient, statement, updatedAt: Date.now() })
    setSaved(true)
  }
  return <div>
    {decision && <div id="print-area" className="print-only" style={{ fontFamily: "Georgia, serif", color: "#000" }}>
      <div style={{ textAlign: "center", borderBottom: "2px solid #000", paddingBottom: 8, marginBottom: 20 }}>
        <strong>KEMENTERIAN LUAR NEGERI REPUBLIK INDONESIA</strong>
        <div>Tim Penilai Organisasi Asing (TPOA)</div>
      </div>
      <h1 style={{ textAlign: "center", fontSize: 18, fontWeight: 700 }}>KEPUTUSAN PERTIMBANGAN TPOA</h1>
      <p style={{ textAlign: "center" }}>{new Date(decision.updatedAt).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" })}</p>
      <p><strong>Organisasi:</strong> {org.name}</p>
      <p><strong>Keputusan:</strong> {decision.result === "setuju" ? "Disetujui" : "Ditolak"}</p>
      <p><strong>Calon K/L mitra:</strong> {decision.recipient}</p>
      <p style={{ marginTop: 24, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{decision.statement}</p>
    </div>}
    <PageTitle title="Pertimbangan TPOA" org={org} />
    <div className="glass p-6 max-[700px]:p-4">
      <div className="grid grid-cols-2 gap-5 max-[700px]:grid-cols-1">
        <Field label="Keputusan TPOA"><select className={field} value={result} onChange={(event) => { const next = event.target.value as "setuju" | "tolak"; setResult(next); setStatement(next === "setuju" ? `Berdasarkan hasil verifikasi dan persetujuan berjenjang, permohonan ${org.name} disetujui untuk melanjutkan kerja sama dengan ${recipient}.` : `Berdasarkan hasil verifikasi dan pertimbangan TPOA, permohonan ${org.name} belum dapat disetujui. Pemberitahuan ini disampaikan kepada calon K/L mitra ${recipient} untuk diketahui dan ditindaklanjuti.`); setSaved(false) }}><option value="setuju">Setuju</option><option value="tolak">Tolak</option></select></Field>
        <Field label="Calon K/L mitra"><input className={field} value={recipient} onChange={(event) => { setRecipient(event.target.value); setSaved(false) }} /></Field>
        <Field label={result === "setuju" ? "Isi persetujuan" : "Isi surat penolakan untuk calon K/L mitra"} wide><textarea className={field} rows={8} value={statement} onChange={(event) => { setStatement(event.target.value); setSaved(false) }} /></Field>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" disabled={!canSaveDecision} onClick={save} className="rounded-md bg-forest-deep px-5 py-2.5 text-[14px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">Simpan keputusan</button>
        {saved && <span role="status" className="text-[13px] text-forest-deep">Keputusan tersimpan sementara.</span>}
        {decision && <button type="button" onClick={() => window.print()} className="rounded-md border border-primary/35 px-5 py-2.5 text-[14px] font-semibold text-primary">Cetak keputusan A4</button>}
      </div>
    </div>
    {!canSaveDecision && <p role="status" className="mt-3 text-[13px] text-amber-700">Selesaikan persetujuan Ketua TPOA dan finalisasi Sekretariat pada halaman verifikasi sebelum menyimpan keputusan.</p>}
    {decision && <div className="mt-4 rounded-md border border-forest/40 bg-forest-soft p-4 text-[13px]">Keputusan terakhir: <strong>{decision.result === "setuju" ? "Setuju" : "Tolak"}</strong>. {decision.result === "setuju" ? "Surat persetujuan dan izin dapat disiapkan pada menu Surat." : "Surat penolakan dapat disiapkan pada menu Surat."}</div>}
    <PageReturn back={{ href: "#/registrasi-ingo/verifikasi", label: "Kembali ke verifikasi" }} />
  </div>
}

export function RegistrationIngoPage({ stage }: { stage: RegistrationStage }) {
  const [orgId, setOrgId] = useLocal("tpoa:active-ingo", initialOrgs[0].id)
  const org = initialOrgs.find((item) => item.id === orgId) ?? initialOrgs[0]
  return <div>
    <PageTitle title="Registrasi INGO" org={org} />
    <OrganizationSelector orgId={org.id} setOrgId={setOrgId} />
    <RegistrationStepNav active={stage} />
    <div key={`${org.id}-${stage}`}>
      {stage === "permohonan" && <RegistrationRequest org={org} />}
      {stage === "verifikasi" && <PersonnelVerification org={org} />}
      {stage === "pertimbangan" && <TpoaConsideration org={org} />}
    </div>
  </div>
}

export function MspExtensionPage() {
  const [orgId, setOrgId] = useLocal("tpoa:active-ingo", initialOrgs[0].id)
  const org = initialOrgs.find((item) => item.id === orgId) ?? initialOrgs[0]
  return <div>
    <PageTitle title="Perpanjangan masa MSP" org={org} />
    <OrganizationSelector orgId={org.id} setOrgId={setOrgId} />
    <MspExtensionForm key={org.id} org={org} />
  </div>
}

function MspExtensionForm({ org }: { org: Org }) {
  const [form, setForm] = useLocal(`tpoa:msp-extension:${org.id}`, { currentPeriod: org.msp, requestedPeriod: "3 tahun", reason: "", workplan: "" })
  const [saved, setSaved] = useState(false)
  const update = (key: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [key]: value }))
    setSaved(false)
  }
  return <div>
    <div className="glass grid grid-cols-2 gap-x-5 gap-y-5 p-6 max-[700px]:grid-cols-1 max-[700px]:p-4">
      <Field label="Masa MSP saat ini"><input className={field} value={form.currentPeriod} onChange={(event) => update("currentPeriod", event.target.value)} /></Field>
      <Field label="Masa perpanjangan yang dimohon"><select className={field} value={form.requestedPeriod} onChange={(event) => update("requestedPeriod", event.target.value)}><option>1 tahun</option><option>2 tahun</option><option>3 tahun</option><option>5 tahun</option></select></Field>
      <Field label="K/L mitra"><input className={field} value={org.kl} readOnly /></Field>
      <Field label="Alasan perpanjangan" wide><textarea className={field} rows={4} value={form.reason} onChange={(event) => update("reason", event.target.value)} /></Field>
      <Field label="Rencana kerja dan capaian" wide><textarea className={field} rows={5} value={form.workplan} onChange={(event) => update("workplan", event.target.value)} /></Field>
    </div>
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <button type="button" onClick={() => setSaved(true)} className="rounded-md bg-forest-deep px-5 py-2.5 text-[14px] font-semibold text-white">Simpan permohonan</button>
      {saved && <span role="status" className="text-[13px] text-forest-deep">Permohonan perpanjangan MSP tersimpan.</span>}
    </div>
    <PageReturn back={{ href: "#/registrasi-ingo/permohonan", label: "Kembali ke registrasi" }} />
  </div>
}