import { useState } from "react"
import { initialOrgs } from "./IngoDashboard"
import { Pendaftaran } from "./Pendaftaran"
import { Field, field } from "./Ingo"
import { readLS, useLocal } from "./store"

const letterTemplates = {
  permohonan: {
    title: "Surat Permohonan",
    subject: "Permohonan registrasi dan kerja sama organisasi",
    body: "Dengan hormat,\n\nBersama surat ini kami mengajukan permohonan registrasi dan kerja sama organisasi. Informasi dan dokumen pendukung disampaikan untuk dapat ditinjau oleh Tim TPOA.\n\nDemikian permohonan ini kami sampaikan. Atas perhatian dan kerja sama Bapak/Ibu, kami ucapkan terima kasih.\n\nHormat kami,\nSekretariat TPOA",
  },
  verifikasi: {
    title: "Surat Verifikasi Dokumen",
    subject: "Hasil verifikasi dokumen registrasi",
    body: "Dengan hormat,\n\nTPOA telah melakukan pemeriksaan awal atas dokumen registrasi. Mohon melengkapi atau memperbaiki dokumen sesuai catatan verifikasi sebelum proses dilanjutkan.\n\nAtas perhatian dan kerja sama Bapak/Ibu, kami ucapkan terima kasih.\n\nHormat kami,\nSekretariat TPOA",
  },
  "undangan-rapat": {
    title: "Surat Undangan Rapat",
    subject: "Undangan rapat pemaparan program",
    body: "Dengan hormat,\n\nSehubungan dengan proses registrasi organisasi, kami mengundang Bapak/Ibu untuk menghadiri rapat pemaparan program bersama TPOA dan kementerian/lembaga mitra.\n\nHari/tanggal: [isi tanggal]\nWaktu: [isi waktu]\nTempat: [isi tempat]\nAgenda: Pemaparan program dan rencana kerja sama\n\nHormat kami,\nSekretariat TPOA",
  },
  pertimbangan: {
    title: "Surat Hasil Pertimbangan",
    subject: "Pemberitahuan hasil pertimbangan TPOA",
    body: "Dengan hormat,\n\nBerdasarkan hasil verifikasi dokumen dan rapat pemaparan, TPOA telah menyelesaikan pertimbangan atas permohonan organisasi. Keputusan dan tindak lanjut disampaikan melalui surat ini.\n\nCatatan/keputusan: [isi hasil pertimbangan]\n\nHormat kami,\nKetua TPOA",
  },
  "izin-prinsip": {
    title: "Surat Izin Prinsip Sementara",
    subject: "Penerbitan izin prinsip sementara",
    body: "Dengan hormat,\n\nBerdasarkan hasil proses registrasi dan pertimbangan TPOA, organisasi diberikan izin prinsip sementara sebagai dasar untuk penjajakan kemitraan dengan kementerian/lembaga terkait.\n\nMasa berlaku: [isi masa berlaku]\nKetentuan: [isi ketentuan]\n\nHormat kami,\nKetua TPOA",
  },
} as const

type LetterTemplateId = keyof typeof letterTemplates

type PlenaryMeeting = {
  id: string
  number: number
  orgId: string
  date: string
  time: string
  location: string
  link: string
  agenda: string
  participantEmails: string
  status: "Terjadwal" | "Selesai"
}

function calendarEscape(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;")
}

function calendarDateTime(date: string, time: string, addMinutes = 0) {
  const [year, month, day] = date.split("-").map(Number)
  const [hour, minute] = time.split(":").map(Number)
  const value = new Date(Date.UTC(year, month - 1, day, hour, minute + addMinutes))
  const pad = (part: number) => String(part).padStart(2, "0")
  return `${value.getUTCFullYear()}${pad(value.getUTCMonth() + 1)}${pad(value.getUTCDate())}T${pad(value.getUTCHours())}${pad(value.getUTCMinutes())}00`
}

function downloadMeetingCalendar(meeting: PlenaryMeeting, orgName: string) {
  const description = calendarEscape(`${meeting.agenda}\nOrganisasi: ${orgName}\nPeserta: ${meeting.participantEmails}`)
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//TPOA//Rapat Pleno//ID", "CALSCALE:GREGORIAN", "BEGIN:VEVENT",
    `UID:${meeting.id}@tpoa.kemlu.go.id`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")}`,
    `DTSTART;TZID=Asia/Jakarta:${calendarDateTime(meeting.date, meeting.time)}`, `DTEND;TZID=Asia/Jakarta:${calendarDateTime(meeting.date, meeting.time, 60)}`,
    `SUMMARY:${calendarEscape(`Rapat Pleno ${meeting.number} · ${orgName}`)}`,
    `DESCRIPTION:${description}`, `LOCATION:${calendarEscape(meeting.location)}`,
    ...(meeting.link ? [`URL:${meeting.link}`] : []), "END:VEVENT", "END:VCALENDAR",
  ]
  const url = URL.createObjectURL(new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8" }))
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = `rapat-pleno-${meeting.number}-${meeting.date}.ics`
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 60000)
}

function PlenarySchedule({ year, defaultOrgId, eligibleOrgs }: { year: number; defaultOrgId: string; eligibleOrgs: typeof initialOrgs }) {
  const [meetings, setMeetings] = useLocal<PlenaryMeeting[]>(`tpoa:plenary:${year}`, [])
  const nextNumber = meetings.reduce((max, meeting) => Math.max(max, meeting.number), 0) + 1
  const addMeeting = () => {
    if (meetings.length >= 6 || nextNumber > 6) return
    setMeetings((current) => [...current, {
      id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
      number: nextNumber,
      orgId: defaultOrgId,
      date: `${year}-01-15`,
      time: "09:00",
      location: "",
      link: "",
      agenda: "",
      participantEmails: "",
      status: "Terjadwal",
    }])
  }
  const updateMeeting = (id: string, key: keyof PlenaryMeeting, value: string) => {
    if (meetings.some((meeting) => meeting.id === id && meeting.status === "Selesai")) return
    if (key === "date" && value && !value.startsWith(`${year}-`)) return
    setMeetings((current) => current.map((meeting) => meeting.id === id ? { ...meeting, [key]: value } : meeting))
  }
  const inviteHref = (meeting: PlenaryMeeting) => {
    const orgName = eligibleOrgs.find((org) => org.id === meeting.orgId)?.name ?? "TPOA"
    const recipients = meeting.participantEmails.split(",").map((email) => email.trim()).filter(Boolean).join(",")
    const subject = `Undangan Rapat Pleno ${meeting.number} TPOA - ${orgName}`
    const body = `Yth. Bapak/Ibu,\n\nKami mengundang Bapak/Ibu untuk menghadiri Rapat Pleno ${meeting.number}.\nTanggal: ${meeting.date}\nWaktu: ${meeting.time} WIB\nTempat: ${meeting.location}\nTautan rapat: ${meeting.link || "Belum ditentukan"}\nAgenda: ${meeting.agenda}\n\nFile kalender .ics dapat dilampirkan setelah diunduh dari halaman agenda.\n\nHormat kami,\nSekretariat TPOA`
    return `mailto:${recipients}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  }
  return <>
    <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
      <div><h2 className="font-display text-xl">Agenda tahun {year} · {meetings.length}/6</h2><p className="mt-1 text-[13px] text-muted">Setiap agenda tersimpan otomatis di perangkat ini. Ubah tanggal dan status langsung dari daftar.</p></div>
      <button type="button" disabled={meetings.length >= 6 || nextNumber > 6} onClick={addMeeting} className="rounded-md bg-forest-deep px-4 py-2.5 text-[13px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">Tambah Rapat Pleno {Math.min(nextNumber, 6)}</button>
    </div>
    {meetings.length === 0 ? <div className="glass p-5 text-[13px] text-muted">Belum ada agenda. Buat Rapat Pleno 1 untuk memulai perencanaan tahun ini.</div> : <div className="space-y-4">
      {meetings.map((meeting) => {
        const orgName = eligibleOrgs.find((org) => org.id === meeting.orgId)?.name ?? "INGO terkait"
        const canPrepareCalendar = Boolean(meeting.date && meeting.time && meeting.agenda.trim())
        return <article key={meeting.id} className="glass p-5">
        <header className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-300/70 pb-3">
          <h3 className="font-display text-lg">Rapat Pleno {meeting.number} <span className="ml-2 font-mono text-[11px] text-muted">dari 6</span></h3>
          <Field label="Status"><select className={field} disabled={meeting.status === "Selesai"} value={meeting.status} onChange={(event) => updateMeeting(meeting.id, "status", event.target.value)}><option>Terjadwal</option><option>Selesai</option></select></Field>
        </header>
        <div className="grid grid-cols-2 gap-4 max-[700px]:grid-cols-1">
          <Field label="INGO terkait"><select className={field} disabled={meeting.status === "Selesai"} value={meeting.orgId} onChange={(event) => updateMeeting(meeting.id, "orgId", event.target.value)}>{eligibleOrgs.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}</select></Field>
          <Field label="Tanggal"><input className={field} disabled={meeting.status === "Selesai"} type="date" value={meeting.date} onChange={(event) => updateMeeting(meeting.id, "date", event.target.value)} /></Field>
          <Field label="Waktu"><input className={field} disabled={meeting.status === "Selesai"} type="time" value={meeting.time} onChange={(event) => updateMeeting(meeting.id, "time", event.target.value)} /></Field>
          <Field label="Tempat"><input className={field} disabled={meeting.status === "Selesai"} value={meeting.location} onChange={(event) => updateMeeting(meeting.id, "location", event.target.value)} placeholder="Lokasi rapat" /></Field>
          <Field label="Tautan rapat"><input className={field} disabled={meeting.status === "Selesai"} type="url" value={meeting.link} onChange={(event) => updateMeeting(meeting.id, "link", event.target.value)} placeholder="https://..." /></Field>
          <Field label="Agenda" wide><textarea className={field} disabled={meeting.status === "Selesai"} rows={3} value={meeting.agenda} onChange={(event) => updateMeeting(meeting.id, "agenda", event.target.value)} /></Field>
          <Field label="Email peserta (pisahkan dengan koma)" wide><input className={field} disabled={meeting.status === "Selesai"} type="text" value={meeting.participantEmails} onChange={(event) => updateMeeting(meeting.id, "participantEmails", event.target.value)} placeholder="peserta@kemlu.go.id, peserta@mitra.go.id" /></Field>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <button type="button" disabled={!canPrepareCalendar} onClick={() => downloadMeetingCalendar(meeting, orgName)} className="rounded-md border border-primary/35 px-4 py-2 text-[13px] font-semibold text-primary disabled:cursor-not-allowed disabled:opacity-50">Unduh kalender .ics</button>
          <a href={inviteHref(meeting)} onClick={(event) => { if (!meeting.participantEmails.includes("@") || !canPrepareCalendar) event.preventDefault() }} aria-disabled={!meeting.participantEmails.includes("@") || !canPrepareCalendar} className={`rounded-md border border-slate-300/70 px-4 py-2 text-[13px] font-semibold ${meeting.participantEmails.includes("@") && canPrepareCalendar ? "text-ink" : "cursor-not-allowed text-muted opacity-50"}`}>Buka email undangan</a>
          <button type="button" disabled={meeting.status === "Selesai"} onClick={() => setMeetings((current) => current.filter((item) => item.id !== meeting.id))} className="rounded-md px-3 py-2 text-[13px] font-semibold text-vermilion disabled:cursor-not-allowed disabled:opacity-40">{meeting.status === "Selesai" ? "Tersimpan sebagai arsip" : "Hapus agenda"}</button>
        </div>
      </article>})}
    </div>}
    {meetings.length >= 6 && <p className="mt-3 text-[13px] text-amber-800">Batas enam rapat pleno untuk tahun {year} sudah tercapai.</p>}
  </>
}

export function PlenaryPlannerPage() {
  const [orgId, setOrgId] = useLocal("tpoa:plenary-org", initialOrgs[0].id)
  const [year, setYear] = useLocal("tpoa:plenary-year", new Date().getFullYear())
  const eligibleOrgs = initialOrgs.filter((org) => {
    const approvals = readLS<{ chairStatus?: string; layer1Approved?: boolean }>(`tpoa:verification-flow:v2:${org.id}`, {})
    const decision = readLS<{ result?: string } | null>(`tpoa:ingo-decision:${org.id}`, null)
    return approvals.chairStatus === "disetujui" && approvals.layer1Approved === true && decision?.result === "setuju"
  })
  const selectedOrg = eligibleOrgs.find((item) => item.id === orgId) ?? eligibleOrgs[0]
  return <div>
    <header className="mb-6 border-b border-slate-300/70 pb-5">
      <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-forest-deep">Agenda · TPOA dan Perizinan</div>
      <h1 className="mt-2 font-display text-[32px] leading-tight">Perencanaan Rapat Pleno</h1>
      <p className="mt-2 text-[13px] text-muted">Maksimal enam rapat pleno per tahun.</p>
    </header>
    <div className="mb-5 grid max-w-2xl grid-cols-2 gap-4 max-[700px]:grid-cols-1">
      {selectedOrg && <Field label="INGO awal untuk agenda baru"><select className={field} value={selectedOrg.id} onChange={(event) => setOrgId(event.target.value)}>{eligibleOrgs.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>}
      <Field label="Tahun"><select className={field} value={year} onChange={(event) => setYear(Number(event.target.value))}>{Array.from({ length: 7 }, (_, index) => new Date().getFullYear() - 1 + index).map((value) => <option key={value}>{value}</option>)}</select></Field>
    </div>
    {eligibleOrgs.length === 0 ? <section className="glass p-5" role="status">
      <h2 className="font-display text-lg">Perencanaan belum dapat dibuka</h2>
      <p className="mt-2 text-[13px] text-muted">Belum ada INGO dengan verifikasi Ketua dan Sekretariat selesai serta keputusan Pertimbangan TPOA disetujui.</p>
      <div className="mt-4 flex flex-wrap gap-4">
        <a href="#/registrasi-ingo/verifikasi" className="font-semibold text-primary underline underline-offset-4">Selesaikan verifikasi berlapis</a>
        <a href="#/registrasi-ingo/pertimbangan" className="font-semibold text-primary underline underline-offset-4">Buka Pertimbangan TPOA</a>
      </div>
    </section> : <PlenarySchedule key={year} year={year} defaultOrgId={selectedOrg.id} eligibleOrgs={eligibleOrgs} />}
  </div>
}

export function LetterTemplatePage({ templateId }: { templateId: LetterTemplateId }) {
  const template = letterTemplates[templateId]
  const storageKey = `tpoa:letter:${templateId}`
  const [draft, setDraft] = useLocal(storageKey, {
    recipient: "Yth. [nama/jabatan penerima]",
    number: "B-____/TPOA/____/2026",
    subject: template.subject,
    body: template.body,
  })
  const [saved, setSaved] = useState(false)
  const update = (key: keyof typeof draft, value: string) => {
    setDraft((current) => ({ ...current, [key]: value }))
    setSaved(false)
  }
  return <div>
    <header className="mb-8 border-b border-slate-300/70 pb-7">
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-forest-deep">Dokumen · TPOA</div>
      <h1 className="mt-3 font-display text-[38px] leading-tight text-ink max-[700px]:text-[30px]">{template.title}</h1>
      <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-muted">Template surat dapat diedit dan disimpan sementara di browser ini.</p>
    </header>
    <div className="glass grid grid-cols-2 gap-x-5 gap-y-5 p-6 max-[700px]:grid-cols-1 max-[700px]:p-4">
      <Field label="Penerima"><input className={field} value={draft.recipient} onChange={(event) => update("recipient", event.target.value)} /></Field>
      <Field label="Nomor surat"><input className={field} value={draft.number} onChange={(event) => update("number", event.target.value)} /></Field>
      <Field label="Perihal" wide><input className={field} value={draft.subject} onChange={(event) => update("subject", event.target.value)} /></Field>
      <Field label="Isi surat" wide><textarea className={field} rows={15} value={draft.body} onChange={(event) => update("body", event.target.value)} /></Field>
      <div className="col-span-2 flex flex-wrap items-center gap-3 max-[700px]:col-span-1">
        <button type="button" onClick={() => setSaved(true)} className="rounded-md bg-forest-deep px-5 py-2.5 text-[14px] font-semibold text-white cursor-pointer">Simpan draft</button>
        {saved && <span className="text-[13px] text-forest-deep">Draft tersimpan di browser ini.</span>}
      </div>
    </div>
    <div id="print-area" className="print-only" style={{ fontFamily: "Georgia, serif", color: "#000" }}>
      <div style={{ textAlign: "center", borderBottom: "2px solid #000", paddingBottom: 8, marginBottom: 16 }}>
        <strong>KEMENTERIAN LUAR NEGERI REPUBLIK INDONESIA</strong><div>Tim Penilai Organisasi Asing (TPOA)</div>
      </div>
      <div style={{ textAlign: "right" }}>Nomor: {draft.number}</div>
      <p>{draft.recipient}</p><p>Perihal: {draft.subject}</p>
      <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", marginTop: 16, lineHeight: 1.6 }}>{draft.body}</pre>
    </div>
  </div>
}

export function IngoWorkflowPage({ kind }: { kind: "registration" | "letter" }) {
  const [orgId, setOrgId] = useState(initialOrgs[0].id)
  const org = initialOrgs.find((item) => item.id === orgId) ?? initialOrgs[0]
  const isLetter = kind === "letter"
  return <div>
    <header className="mb-8 border-b border-slate-300/70 pb-7">
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-forest-deep">Layanan · INGO</div>
      <h1 className="mt-3 font-display text-[38px] leading-tight text-ink max-[700px]:text-[30px]">{isLetter ? "Surat Rekomendasi" : "Registrasi INGO"}</h1>
      <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-muted">{isLetter ? "Pilih organisasi untuk menyusun, mengedit, mencetak, dan mengirim surat rekomendasi." : "Pilih organisasi untuk membuka dan mengelola alur registrasi INGO."}</p>
      <div className="mt-5 max-w-md">
        <Field label="Pilih INGO">
          <select className="w-full rounded-lg border border-slate-300/70 bg-white/70 px-3 py-2.5 text-[14px]" value={orgId} onChange={(event) => setOrgId(event.target.value)}>
            {initialOrgs.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </Field>
      </div>
    </header>
    <div className="glass p-6 max-[700px]:p-4" key={`${org.id}-${kind}`}>
      <Pendaftaran org={org} standaloneLetter={isLetter} />
    </div>
  </div>
}