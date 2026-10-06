import { useState } from "react"
import { initialOrgs } from "./IngoDashboard"
import { useLocal } from "./store"
import type { Org } from "./Ingo"

type Foundation = {
  id: string
  name: string
  province: string
  partner: string
  field: string
  status: string
}

const initialFoundations: Foundation[] = [
  { id: "foundation-1", name: "Yayasan Pendidikan Nusantara", province: "DKI Jakarta", partner: "Kemendikdasmen", field: "Pendidikan", status: "Aktif" },
  { id: "foundation-2", name: "Yayasan Sehat Bersama", province: "Jawa Barat", partner: "Kementerian Kesehatan", field: "Kesehatan", status: "Dalam verifikasi" },
]

const tableInput = "w-full min-w-32 rounded-md border border-slate-300 bg-white/80 px-2 py-2 text-[13px]"

function DataTable<T extends { id: string }>({
  rows,
  columns,
  onChange,
  noun,
  create,
}: {
  rows: T[]
  columns: [keyof T, string][]
  onChange: (rows: T[]) => void
  noun: string
  create: () => T
}) {
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState<T | null>(null)
  const startNew = () => {
    const row = create()
    setDraft(row)
    setEditing(row.id)
  }
  const updateDraft = (key: keyof T, value: string) => {
    setDraft((current) => current ? { ...current, [key]: value } : current)
  }
  const save = () => {
    if (!draft) return
    const exists = rows.some((row) => row.id === draft.id)
    onChange(exists ? rows.map((row) => row.id === draft.id ? draft : row) : [...rows, draft])
    setEditing(null)
    setDraft(null)
  }
  return (
    <>
      <div className="mb-3 flex justify-end">
        <button type="button" onClick={startNew} className="rounded-md bg-forest-deep px-4 py-2 text-[13px] font-semibold text-white cursor-pointer">+ Tambah {noun}</button>
      </div>
      <div className="glass overflow-x-auto">
        <table className="w-full min-w-[760px] text-[13px]">
          <thead><tr className="border-b border-slate-300/70 text-left font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
            {columns.map(([, label]) => <th key={label} className="p-3 font-normal">{label}</th>)}
            <th className="p-3 font-normal">Aksi</th>
          </tr></thead>
          <tbody>
            {rows.map((row) => {
              const active = editing === row.id
              const shown = active && draft ? draft : row
              return (
                <tr key={row.id} className="border-b border-slate-200/80 last:border-0">
                  {columns.map(([key], index) => (
                    <td key={String(key)} className="p-2">
                      {active ? <input className={tableInput} value={String(shown[key] ?? "")} onChange={(event) => updateDraft(key, event.target.value)} /> : <span className={index === 0 ? "font-semibold" : ""}>{String(row[key] ?? "") || "—"}</span>}
                    </td>
                  ))}
                  <td className="p-2 whitespace-nowrap">
                    {active ? <>
                      <button type="button" onClick={save} className="font-semibold text-forest-deep cursor-pointer">Simpan</button>
                      <button type="button" onClick={() => { setEditing(null); setDraft(null) }} className="ml-3 text-muted cursor-pointer">Batal</button>
                    </> : <button type="button" onClick={() => { setDraft({ ...row }); setEditing(row.id) }} className="font-semibold text-primary cursor-pointer">Edit</button>}
                  </td>
                </tr>
              )
            })}
            {rows.length === 0 && <tr><td colSpan={columns.length + 1} className="p-6 text-center text-muted">Belum ada data {noun}.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  )
}

function IngoTable({ rows, onChange }: { rows: Org[]; onChange: (rows: Org[]) => void }) {
  const columns: [keyof Org, string][] = [
    ["name", "Nama INGO"], ["country", "Negara asal"], ["kl", "K/L mitra"],
    ["field", "Bidang"], ["funding", "Pendanaan"], ["msp", "Masa berlaku MSP"], ["status", "Status"],
  ]
  return <DataTable rows={rows} columns={columns} onChange={onChange} noun="INGO" create={() => ({ id: globalThis.crypto?.randomUUID?.() ?? String(Date.now()), name: "", country: "", kl: "", field: "", funding: "", msp: "", status: "Dalam verifikasi" })} />
}

function FoundationTable({ rows, onChange }: { rows: Foundation[]; onChange: (rows: Foundation[]) => void }) {
  const columns: [keyof Foundation, string][] = [
    ["name", "Nama Yayasan"], ["province", "Provinsi"], ["partner", "K/L mitra"], ["field", "Bidang"], ["status", "Status"],
  ]
  return <DataTable rows={rows} columns={columns} onChange={onChange} noun="Yayasan" create={() => ({ id: globalThis.crypto?.randomUUID?.() ?? String(Date.now()), name: "", province: "", partner: "", field: "", status: "Dalam verifikasi" })} />
}

function PageHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <header className="mb-8 border-b border-slate-300/70 pb-7">
    <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-forest-deep">{eyebrow}</div>
    <h1 className="mt-3 font-display text-[38px] leading-tight text-ink max-[700px]:text-[30px]">{title}</h1>
    <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-muted">{description}</p>
  </header>
}

export type ThemeMode = "light" | "dark"
type FontStyle = "manrope" | "sora"
type AccentColor = "teal" | "blue"

const informationRoles = [
  { id: "developer", title: "Pengembang", name: "[Isi nama pengembang]", contact: "[Isi kontak pengembang]" },
  { id: "support", title: "Support system", name: "[Isi nama support system]", contact: "[Isi kontak support system]" },
  { id: "researcher", title: "Peneliti utama", name: "[Isi nama peneliti utama]", contact: "[Isi kontak peneliti utama]" },
  { id: "chair", title: "Ketua TPOA", name: "[Isi nama Ketua TPOA]", contact: "[Isi kontak Ketua TPOA]" },
  { id: "secretariat", title: "Sekretariat TPOA", name: "[Isi nama Sekretariat TPOA]", contact: "[Isi kontak Sekretariat TPOA]" },
  { id: "subdirectorate", title: "Kasubdit", name: "[Isi nama Kasubdit]", contact: "[Isi kontak Kasubdit]" },
] as const

type FeedbackEntry = { id: string; message: string; createdAt: string }

function DashboardSettings({ theme, onThemeChange, fontStyle, onFontStyleChange, accentColor, onAccentColorChange }: {
  theme: ThemeMode
  onThemeChange: (theme: ThemeMode) => void
  fontStyle: FontStyle
  onFontStyleChange: (font: FontStyle) => void
  accentColor: AccentColor
  onAccentColorChange: (accent: AccentColor) => void
}) {
  return <section className="mt-10 border-t border-slate-300/70 pt-7">
    <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-forest-deep">Preferensi</div>
    <h2 className="mt-2 font-display text-2xl">Pengaturan tampilan</h2>
    <p className="mt-1 text-[13px] text-muted">Pilihan disimpan untuk browser ini.</p>
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <span className="text-[14px]">Mode warna</span>
      <div role="group" aria-label="Mode warna" className="inline-flex rounded-md border border-slate-300/70 bg-white/55 p-1">
        {(["light", "dark"] as const).map((mode) => <button key={mode} type="button" aria-pressed={theme === mode} onClick={() => onThemeChange(mode)} className={`rounded px-4 py-2 text-[13px] font-semibold transition-colors ${theme === mode ? "bg-forest-deep text-white" : "text-muted hover:text-ink"}`}>{mode === "light" ? "Terang" : "Gelap"}</button>)}
      </div>
    </div>
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <span className="text-[14px]">Font</span>
      <div role="group" aria-label="Pilihan font" className="inline-flex rounded-md border border-slate-300/70 bg-white/55 p-1">
        {(["manrope", "sora"] as const).map((font) => <button key={font} type="button" aria-pressed={fontStyle === font} onClick={() => onFontStyleChange(font)} className={`rounded px-4 py-2 text-[13px] font-semibold transition-colors ${fontStyle === font ? "bg-forest-deep text-white" : "text-muted hover:text-ink"}`}>{font === "manrope" ? "Manrope" : "Sora"}</button>)}
      </div>
    </div>
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <span className="text-[14px]">Warna aksen</span>
      {(["teal", "blue"] as const).map((accent) => <button key={accent} type="button" aria-label={accent === "teal" ? "Aksen teal" : "Aksen biru"} aria-pressed={accentColor === accent} onClick={() => onAccentColorChange(accent)} className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-[13px] ${accentColor === accent ? "border-forest-deep bg-forest-soft text-ink" : "border-slate-300/70 text-muted"}`}><span className={`size-4 rounded-full ${accent === "teal" ? "bg-teal-600" : "bg-blue-600"}`} />{accent === "teal" ? "Teal" : "Biru"}</button>)}
    </div>
  </section>
}

function InformationCenter() {
  const [feedbacks, setFeedbacks] = useLocal<FeedbackEntry[]>("tpoa:feedback", [])
  const [message, setMessage] = useState("")
  const [selectedRole, setSelectedRole] = useState<(typeof informationRoles)[number]["id"]>("developer")
  const role = informationRoles.find((item) => item.id === selectedRole) ?? informationRoles[0]
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const clean = message.trim()
    if (!clean) return
    setFeedbacks((current) => [{ id: globalThis.crypto?.randomUUID?.() ?? String(Date.now()), message: clean, createdAt: new Date().toLocaleString("id-ID") }, ...current].slice(0, 20))
    setMessage("")
  }
  return <section>
    <div className="grid grid-cols-2 gap-6 max-[800px]:grid-cols-1">
      <div>
        <h3 className="font-display text-lg">Feedback pengembangan</h3>
        <form className="mt-3" onSubmit={submit}>
          <label className="block"><span className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.12em] text-muted">Masukan untuk pembaruan web</span><textarea className="w-full rounded-lg border border-slate-300/70 bg-white/70 px-3 py-2.5 text-[14px]" rows={4} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Tulis masukan atau kendala…" /></label>
          <button type="submit" disabled={!message.trim()} className="mt-3 rounded-md bg-forest-deep px-5 py-2.5 text-[14px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">Kirim feedback</button>
        </form>
        {feedbacks.length > 0 && <div className="mt-4 space-y-2">{feedbacks.slice(0, 3).map((item) => <div key={item.id} className="border-l-2 border-forest bg-white/35 px-3 py-2 text-[13px]"><p>{item.message}</p><time className="mt-1 block font-mono text-[10px] text-muted">{item.createdAt}</time></div>)}</div>}
      </div>
      <div>
        <h3 className="font-display text-lg">Kontak dan peran</h3>
        <div role="tablist" aria-label="Peran pusat informasi" className="mt-3 flex flex-wrap gap-1 border-b border-slate-300/70 pb-2">
          {informationRoles.map((item) => <button key={item.id} type="button" role="tab" aria-selected={selectedRole === item.id} onClick={() => setSelectedRole(item.id)} className={`rounded px-2.5 py-1.5 text-[12px] transition-colors ${selectedRole === item.id ? "bg-forest-soft font-semibold text-forest-deep" : "text-muted hover:text-ink"}`}>{item.title}</button>)}
        </div>
        <div role="tabpanel" className="mt-4 rounded-md border border-slate-300/70 bg-white/35 p-4">
          <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">{role.title}</div>
          <div className="mt-2 font-display text-lg">{role.name}</div>
          <div className="mt-1 text-[13px] text-muted">{role.contact}</div>
        </div>
      </div>
    </div>
  </section>
}

export function DashboardHome() {
  const [ingos, setIngos] = useLocal<Org[]>("tpoa:dashboard-ingos", initialOrgs)
  const [foundations, setFoundations] = useLocal("tpoa:yayasan", initialFoundations)
  const [open, setOpen] = useState<"ingo" | "yayasan" | null>(null)
  const now = new Date()
  const hour = now.getHours()
  const greeting = hour < 11 ? "Selamat pagi" : hour < 15 ? "Selamat siang" : hour < 18 ? "Selamat sore" : "Selamat malam"
  const date = now.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
  return <div>
    <PageHeading eyebrow={greeting} title="Selamat datang, Staf TPOA" description="Portal internal untuk memantau data organisasi, mengelola registrasi, dan menyiapkan dokumen kerja sama." />
    <div className="mb-6 font-mono text-[11px] uppercase tracking-[0.12em] text-muted">{date}</div>
    <div className="mb-8 flex flex-wrap gap-3">
      <a href="#/registrasi-ingo" className="rounded-md bg-forest-deep px-5 py-3 text-[14px] font-semibold text-white transition-colors hover:bg-forest">Registrasi INGO</a>
      <a href="#/registrasi-yayasan" className="rounded-md border border-forest-deep/40 bg-white/60 px-5 py-3 text-[14px] font-semibold text-forest-deep transition-colors hover:bg-white">Registrasi Yayasan</a>
    </div>
    <div className="grid grid-cols-2 gap-4 max-[700px]:grid-cols-1">
      <button type="button" onClick={() => setOpen(open === "ingo" ? null : "ingo")} aria-expanded={open === "ingo"} className="glass flex items-center justify-between gap-4 p-5 text-left transition-transform hover:-translate-y-0.5 cursor-pointer">
        <span><span className="block font-mono text-[10px] uppercase tracking-[0.14em] text-muted">{String(ingos.length).padStart(2, "0")} terdaftar</span><span className="mt-2 block font-display text-2xl">INGO</span></span>
        <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full border border-slate-300 bg-white/60 text-xl text-forest-deep">{open === "ingo" ? "−" : "+"}</span>
      </button>
      <button type="button" onClick={() => setOpen(open === "yayasan" ? null : "yayasan")} aria-expanded={open === "yayasan"} className="glass flex items-center justify-between gap-4 p-5 text-left transition-transform hover:-translate-y-0.5 cursor-pointer">
        <span><span className="block font-mono text-[10px] uppercase tracking-[0.14em] text-muted">{String(foundations.length).padStart(2, "0")} terdaftar</span><span className="mt-2 block font-display text-2xl">Yayasan</span></span>
        <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full border border-slate-300 bg-white/60 text-xl text-forest-deep">{open === "yayasan" ? "−" : "+"}</span>
      </button>
    </div>
    <div className={`dashboard-expand ${open === "ingo" ? "is-open" : ""}`} aria-hidden={open !== "ingo"}>
      <div className="min-h-0 overflow-hidden">{open === "ingo" && <div className="pt-5"><IngoTable rows={ingos} onChange={setIngos} /></div>}</div>
    </div>
    <div className={`dashboard-expand ${open === "yayasan" ? "is-open" : ""}`} aria-hidden={open !== "yayasan"}>
      <div className="min-h-0 overflow-hidden">{open === "yayasan" && <div className="pt-5"><FoundationTable rows={foundations} onChange={setFoundations} /></div>}</div>
    </div>
  </div>
}

export function SettingsPage({ theme, onThemeChange, fontStyle, onFontStyleChange, accentColor, onAccentColorChange }: {
  theme: ThemeMode
  onThemeChange: (theme: ThemeMode) => void
  fontStyle: FontStyle
  onFontStyleChange: (font: FontStyle) => void
  accentColor: AccentColor
  onAccentColorChange: (accent: AccentColor) => void
}) {
  return <div>
    <PageHeading eyebrow="Preferensi pengguna" title="Pengaturan tampilan" description="Atur mode warna, font, dan aksen untuk seluruh halaman. Preferensi disimpan pada browser ini." />
    <DashboardSettings theme={theme} onThemeChange={onThemeChange} fontStyle={fontStyle} onFontStyleChange={onFontStyleChange} accentColor={accentColor} onAccentColorChange={onAccentColorChange} />
  </div>
}

export function InformationCenterPage() {
  return <div>
    <PageHeading eyebrow="Informasi & masukan" title="Pusat informasi" description="Kirim masukan pengembangan web atau lihat kontak dan peran terkait." />
    <InformationCenter />
  </div>
}

export function YayasanPage() {
  const [rows, setRows] = useLocal("tpoa:yayasan", initialFoundations)
  return <div><PageHeading eyebrow="Data organisasi · 02" title="Data Yayasan" description="Data contoh yayasan dapat ditambah atau diedit. Perubahan tersimpan sementara di browser ini." /><FoundationTable rows={rows} onChange={setRows} /></div>
}

export function RegistrationYayasan() {
  const [form, setForm] = useLocal("tpoa:registrasi-yayasan", { nama: "", nomor: "", tanggal: "", penanggungJawab: "", bidang: "", catatan: "" })
  const [saved, setSaved] = useState(false)
  const update = (key: keyof typeof form, value: string) => { setForm((current) => ({ ...current, [key]: value })); setSaved(false) }
  return <div>
    <PageHeading eyebrow="Layanan · Yayasan" title="Registrasi Yayasan" description="Formulir untuk mencatat registrasi yayasan. Data formulir tersimpan sementara di browser." />
    <form className="glass grid grid-cols-2 gap-x-5 gap-y-5 p-6 max-[700px]:grid-cols-1 max-[700px]:p-4" onSubmit={(event) => { event.preventDefault(); setSaved(true) }}>
      {([["nama", "Nama yayasan"], ["nomor", "Nomor akta / registrasi"], ["tanggal", "Tanggal pendirian"], ["penanggungJawab", "Penanggung jawab"], ["bidang", "Bidang kegiatan"]] as const).map(([key, label]) => <label key={key} className="block"><span className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.12em] text-muted">{label}</span><input className="w-full rounded-lg border border-slate-300/70 bg-white/70 px-3 py-2.5 text-[14px]" type={key === "tanggal" ? "date" : "text"} value={form[key]} onChange={(event) => update(key, event.target.value)} /></label>)}
      <label className="col-span-2 block max-[700px]:col-span-1"><span className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.12em] text-muted">Catatan</span><textarea className="w-full rounded-lg border border-slate-300/70 bg-white/70 px-3 py-2.5 text-[14px]" rows={4} value={form.catatan} onChange={(event) => update("catatan", event.target.value)} /></label>
      <div className="col-span-2 flex items-center gap-4 max-[700px]:col-span-1"><button className="rounded-md bg-forest-deep px-5 py-2.5 text-[14px] font-semibold text-white cursor-pointer" type="submit">Simpan registrasi</button>{saved && <span className="text-[13px] text-forest-deep">Data tersimpan sementara.</span>}</div>
    </form>
  </div>
}