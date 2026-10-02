import { type ChangeEvent, type ReactNode } from "react"

export const REG_EMAIL = "reg.ingo@kemlu.go.id"

/* ───────────── tanggal & hari kerja ───────────── */

export const fmt = (d: Date) =>
  d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })

export const parseISO = (s: string) => new Date(`${s}T00:00:00`)

export const toISO = (d: Date) => {
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${d.getFullYear()}-${m}-${day}`
}

export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
const isWorkday = (d: Date) => d.getDay() !== 0 && d.getDay() !== 6

// Menambah hari kerja (Senin–Jumat). Libur nasional belum diperhitungkan.
export function addBusinessDays(start: Date, n: number) {
  const d = startOfDay(start)
  let added = 0
  while (added < n) {
    d.setDate(d.getDate() + 1)
    if (isWorkday(d)) added++
  }
  return d
}

// Selisih hari kerja dari hari ini ke tanggal target (negatif jika sudah lewat).
export function businessDaysUntil(target: Date, from: Date = new Date()) {
  const a = startOfDay(from)
  const b = startOfDay(target)
  const forward = b.getTime() >= a.getTime()
  const d = new Date(forward ? a : b)
  const end = forward ? b : a
  let n = 0
  while (d.getTime() < end.getTime()) {
    d.setDate(d.getDate() + 1)
    if (isWorkday(d)) n++
  }
  return forward ? n : -n
}

export const sizeLabel = (n: number) =>
  n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`

/* ───────────── data referensi ───────────── */

export const stages = [
  { title: "Pengajuan Awal", by: "Otomatis dari email INGO" },
  { title: "Verifikasi Dokumen", by: "TPOA · 14 hari kerja" },
  { title: "Rapat Pemaparan", by: "TPOA & INGO" },
  { title: "Pertimbangan", by: "Setuju / Tolak" },
  { title: "Surat Rekomendasi", by: "Izin Prinsip Sementara" },
  { title: "Surat Izin Tetap", by: "Coming soon" },
]

export const docs = [
  { n: "Surat permohonan resmi", f: "surat-permohonan.pdf", syarat: "Bermaterai, ditandatangani pimpinan INGO, ditujukan kepada Menteri Luar Negeri." },
  { n: "Akta pendirian & AD/ART organisasi induk", f: "akta-adart.pdf", syarat: "Salinan sah, diterjemahkan ke Bahasa Indonesia atau Inggris oleh penerjemah tersumpah." },
  { n: "Profil organisasi & rekam jejak global", f: "profil-organisasi.pdf", syarat: "Memuat visi misi, negara operasi, dan program 5 tahun terakhir." },
  { n: "Laporan keuangan teraudit 3 tahun terakhir", f: "audit-2023-2025.pdf", syarat: "Diaudit auditor independen; mencakup 3 tahun buku terakhir berturut-turut." },
  { n: "Proposal program 3 tahun", f: "proposal-program.pdf", syarat: "Memuat tujuan, wilayah, anggaran, indikator capaian, dan strategi keluar." },
  { n: "Surat dukungan calon K/L mitra", f: "dukungan-kl.pdf", syarat: "Ditandatangani pejabat K/L mitra yang dituju dan masih berlaku." },
  { n: "Surat penunjukan kepala perwakilan", f: "penunjukan-kepala.pdf", syarat: "Diterbitkan organisasi induk, menyebut nama dan jabatan kepala perwakilan." },
  { n: "Salinan paspor penanggung jawab", f: "paspor-pj.pdf", syarat: "Masa berlaku paspor minimal 18 bulan dari tanggal pengajuan." },
]

export const klList = [
  "Kementerian Kesehatan",
  "Kementerian Pendidikan Dasar dan Menengah",
  "Kementerian Sosial",
  "Kementerian Lingkungan Hidup",
  "Kementerian Desa dan PDT",
  "BNPB",
]

// Alamat email dummy; TPOA dapat mengubahnya langsung di formulir.
export const klEmail: Record<string, string> = {
  "Kementerian Kesehatan": "sekretariat@kemenkes.example",
  "Kementerian Pendidikan Dasar dan Menengah": "sekretariat@kemendikdasmen.example",
  "Kementerian Sosial": "sekretariat@kemensos.example",
  "Kementerian Lingkungan Hidup": "sekretariat@klh.example",
  "Kementerian Desa dan PDT": "sekretariat@kemendesa.example",
  BNPB: "sekretariat@bnpb.example",
}

export const fileKinds = ["Surat izin prinsip sementara", "Lampiran pendukung"]
export const bidangList = ["Perlindungan Anak", "Kesehatan", "Pendidikan", "Kemanusiaan", "Lingkungan", "Kebencanaan"]
export const materiList = ["Ringkasan eksekutif program", "Matriks risiko & mitigasi", "Anggaran rinci per tahun", "Surat komitmen pendanaan"]
export const kriteria = ["Relevansi dengan prioritas nasional", "Kelayakan teknis & keberlanjutan", "Transparansi pendanaan", "Kesiapan mitra K/L"]

/* ───────────── tipe data ───────────── */

export type Org = { id: string; name: string; country: string; kl: string; field: string; funding: string; msp: string; status: string }

export type Person = {
  id: number
  nama: string
  jabatan: string
  negara: string
  email: string
  izin: string
  berlaku: string
  valid?: boolean
  touched?: boolean
}

export type Detail = {
  tahun: string
  pj: string
  email: string
  alamat: string
  wilayah: string
  durasi: string
  ringkasan: string
  izinPrinsip: string
  diterima: string
}

// Contoh lengkap hanya untuk ChildFund Organization; INGO lain dimulai dari formulir kosong.
const childfund: Detail = {
  tahun: "1938",
  pj: "Meredith Hale",
  email: "indonesia@childfund.example",
  alamat: "Jl. Wijaya I No. 18, Kebayoran Baru, Jakarta Selatan",
  wilayah: "Nusa Tenggara Timur",
  durasi: "3 tahun (2027–2029)",
  ringkasan:
    "Peningkatan gizi dan layanan kesehatan dasar bagi anak usia di bawah lima tahun di 40 desa, bersama puskesmas dan pemerintah daerah.",
  izinPrinsip: "IP-S/0147/2026",
  diterima: "2026-09-21",
}

const blank: Detail = {
  tahun: "",
  pj: "",
  email: "",
  alamat: "",
  wilayah: "",
  durasi: "",
  ringkasan: "",
  izinPrinsip: "",
  diterima: toISO(new Date()),
}

const auto: Record<string, Partial<Detail>> = {
  stc: { tahun: "1919", pj: "Amelia Grant", email: "indonesia@stc.example", alamat: "Jl. TB Simatupang No. 5, Jakarta Selatan", wilayah: "Jawa Barat", durasi: "3 tahun (2027–2029)", ringkasan: "Peningkatan akses pendidikan dasar berkualitas bagi anak di daerah terpencil.", diterima: "2026-09-24" },
  wv: { tahun: "1950", pj: "Jonathan Reyes", email: "indonesia@wvi.example", alamat: "Jl. Wahid Hasyim No. 33, Jakarta Pusat", wilayah: "Sulawesi Tengah", durasi: "3 tahun (2027–2029)", ringkasan: "Respons kemanusiaan dan pemulihan komunitas pascabencana.", diterima: "2026-09-25" },
  plan: { tahun: "1937", pj: "Sophie Laurent", email: "indonesia@plan.example", alamat: "Jl. Jenderal Sudirman Kav. 52, Jakarta Selatan", wilayah: "Nusa Tenggara Barat", durasi: "3 tahun (2027–2029)", ringkasan: "Pemberdayaan anak perempuan melalui pendidikan dan keterampilan hidup.", diterima: "2026-09-28" },
  mc: { tahun: "1979", pj: "Country Director Mercy Corps", email: "indonesia@mercycorps.example", alamat: "Jl. Kemang Raya No. 10, Jakarta Selatan", wilayah: "Sulawesi Barat", durasi: "3 tahun (2027–2029)", ringkasan: "Kesiapsiagaan dan ketahanan komunitas menghadapi bencana.", diterima: "2026-09-29" },
  mdm: { tahun: "1980", pj: "Claire Dubois", email: "indonesia@mdm.example", alamat: "Jl. Cipete Raya No. 7, Jakarta Selatan", wilayah: "Maluku", durasi: "3 tahun (2027–2029)", ringkasan: "Layanan kesehatan dasar bagi kelompok rentan.", diterima: "2026-09-30" },
}
export const detailOf = (o: Org): Detail => (o.id === "cf" ? childfund : { ...blank, ...(auto[o.id] ?? {}) })

/* ───────────── komponen kecil ───────────── */

export const field =
  "w-full bg-white/70 border border-slate-300/70 rounded-lg px-3 py-2.5 text-[14px] focus:border-forest focus:bg-white placeholder:text-muted/60"

export const cellInput =
  "w-full bg-white/70 border border-slate-300/70 rounded-md px-2 py-1.5 text-[13px] focus:border-forest focus:bg-white placeholder:text-muted/60"

export function Field({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <label className={`block ${wide ? "col-span-2 max-[700px]:col-span-1" : ""}`}>
      <span className="block font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted mb-1.5">
        {label}
      </span>
      {children}
    </label>
  )
}

export function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="mb-10">
      <h3 className="font-display text-[26px] leading-tight text-ink">{title}</h3>
      {hint && <p className="text-muted text-[14px] mt-1 max-w-2xl">{hint}</p>}
      <div className="mt-5">{children}</div>
    </section>
  )
}

export function Btn({
  children,
  onClick,
  variant = "primary",
  disabled,
}: {
  children: ReactNode
  onClick?: () => void
  variant?: "primary" | "ghost" | "danger"
  disabled?: boolean
}) {
  const v = {
    primary:
      "bg-linear-to-r from-primary to-forest text-white shadow-[0_8px_22px_-8px_rgba(37,99,235,0.6)] hover:brightness-110",
    ghost: "border border-primary/35 text-primary hover:bg-primary/5",
    danger: "bg-vermilion text-white hover:brightness-110",
  }[variant]
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-5 py-2.5 rounded-lg text-[14px] font-medium transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${v}`}
    >
      {children}
    </button>
  )
}

export function Banner({ tone, children }: { tone: "warn" | "ok" | "bad"; children: ReactNode }) {
  const t = {
    warn: "bg-ochre-soft border-ochre text-ink",
    ok: "bg-forest-soft border-forest text-ink",
    bad: "bg-vermilion-soft border-vermilion text-ink",
  }[tone]
  return <div className={`border-l-4 rounded-r-lg px-5 py-4 text-[14px] leading-relaxed mb-6 ${t}`}>{children}</div>
}

export function Meta({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">{label}</div>
      <div className="font-display text-[17px] mt-0.5">{children}</div>
    </div>
  )
}

export const suratTemplate = (org: string, kl: string) =>
  `Yth. Menteri/Kepala ${kl}

Perihal: Rekomendasi kemitraan ${org} — Surat Izin Prinsip Sementara

Berdasarkan hasil verifikasi dokumen, rapat pemaparan, dan pertimbangan TPOA, permohonan INGO ${org} dinyatakan layak untuk dilanjutkan. Bersama surat ini kami sampaikan Surat Izin Prinsip Sementara sebagai dasar penjajakan kemitraan dengan ${kl}.

Atas perhatian dan kerja sama Bapak/Ibu, kami ucapkan terima kasih.

Hormat kami,
Ketua TPOA`

export type Form = {
  nama: string
  negara: string
  tahun: string
  bidang: string
  pj: string
  email: string
  alamat: string
  wilayah: string
  durasi: string
  kl: string
  ringkasan: string
}

export type Letter = { kl: string; to: string; cc: string | null; nomor: string; perihal: string; body: string }
export type Attach = { id: number; file: File; kind: string }
export type FieldEvent = ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>

