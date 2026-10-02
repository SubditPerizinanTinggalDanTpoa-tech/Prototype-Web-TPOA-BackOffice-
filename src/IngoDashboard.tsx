import { useState, type ReactNode } from "react"
import { Pendaftaran } from "./Pendaftaran"
import { Personil } from "./Personil"
import { Pengajuan, MonitoringLanjutan } from "./Monitoring"
import { useLocal, addLog, bump } from "./store"
import {
  Field,
  Section,
  Btn,
  Banner,
  field,
  detailOf,
  type Org,
  type Person,
} from "./Ingo"

const initialOrgs: Org[] = [
  {
    id: "cf",
    name: "ChildFund Organization",
    country: "Amerika Serikat",
    kl: "Kementerian Sosial",
    field: "Perlindungan Anak",
    funding: "USD 4,2 juta",
    msp: "14 Mar 2024 – 13 Mar 2027",
    status: "Aktif",
  },
  {
    id: "stc",
    name: "Save the Children",
    country: "Inggris",
    kl: "Kementerian PPPA",
    field: "Pendidikan",
    funding: "USD 6,8 juta",
    msp: "02 Agu 2023 – 01 Agu 2026",
    status: "MSP berakhir",
  },
  {
    id: "wv",
    name: "World Vision International",
    country: "Amerika Serikat",
    kl: "Kementerian Sosial",
    field: "Kemanusiaan",
    funding: "USD 9,1 juta",
    msp: "21 Jan 2025 – 20 Jan 2028",
    status: "Aktif",
  },
  {
    id: "plan",
    name: "Plan International",
    country: "Inggris",
    kl: "Kemendikdasmen",
    field: "Pendidikan",
    funding: "USD 3,5 juta",
    msp: "11 Nov 2024 – 10 Nov 2027",
    status: "Aktif",
  },
  {
    id: "mc",
    name: "Mercy Corps",
    country: "Amerika Serikat",
    kl: "BNPB",
    field: "Kebencanaan",
    funding: "USD 2,9 juta",
    msp: "05 Jun 2025 – 04 Jun 2028",
    status: "Aktif",
  },
  {
    id: "mdm",
    name: "Médecins du Monde",
    country: "Prancis",
    kl: "Kementerian Kesehatan",
    field: "Kesehatan",
    funding: "EUR 1,7 juta",
    msp: "17 Sep 2023 – 16 Sep 2026",
    status: "Perpanjangan",
  },
]

const person = (
  id: number,
  nama: string,
  jabatan: string,
  negara: string,
  email: string,
  izin: string,
  berlaku = "",
): Person => ({
  id,
  nama,
  jabatan,
  negara,
  email,
  izin,
  berlaku,
})

// Data personil dummy. Pada ChildFund sengaja ada baris yang belum lengkap sebagai contoh.
const initialPersonnel: Record<string, Person[]> = {
  cf: [
    person(
      1,
      "Meredith Hale",
      "Country Director",
      "Amerika Serikat",
      "m.hale@childfund.example",
      "KITAS",
      "2027-03-31",
    ),
    person(
      2,
      "Rina Kusumawati",
      "Program Manager",
      "Indonesia",
      "rina.k@childfund.example",
      "WNI",
    ),
    person(
      3,
      "Daniel Okafor",
      "Finance Lead",
      "Nigeria",
      "d.okafor@childfund.example",
      "KITAS",
    ),
    person(
      4,
      "Yohanis Lede",
      "Koordinator Lapangan NTT",
      "Indonesia",
      "",
      "WNI",
    ),
  ],
  stc: [
    person(
      1,
      "Amelia Grant",
      "Country Director",
      "Inggris",
      "a.grant@stc.example",
      "KITAS",
      "2026-12-15",
    ),
    person(
      2,
      "Bayu Pratama",
      "Program Manager",
      "Indonesia",
      "bayu@stc.example",
      "WNI",
    ),
  ],
  wv: [
    person(
      1,
      "Jonathan Reyes",
      "National Director",
      "Filipina",
      "j.reyes@wvi.example",
      "KITAP",
      "2029-05-20",
    ),
  ],
  plan: [
    person(
      1,
      "Sophie Laurent",
      "Country Director",
      "Prancis",
      "s.laurent@plan.example",
      "KITAS",
      "2027-08-01",
    ),
  ],
  mc: [],
  mdm: [
    person(
      1,
      "Claire Dubois",
      "Kepala Misi",
      "Prancis",
      "c.dubois@mdm.example",
      "KITAS",
      "2026-11-30",
    ),
  ],
}

const glass = "glass"

const cell =
  "w-full bg-white/80 border border-forest/60 rounded-md px-2 py-1.5 text-[13px]"

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <div className="font-mono text-[10.5px] tracking-[0.2em] uppercase text-forest-deep">
      {children}
    </div>
  )
}

function Pill({ s }: { s: string }) {
  const tone =
    s === "Aktif"
      ? "text-forest-deep bg-forest-soft"
      : s === "MSP berakhir"
        ? "text-rose-600 bg-vermilion-soft"
        : "text-amber-700 bg-ochre-soft"
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-mono ${tone}`}
    >
      {s}
    </span>
  )
}

function IzinOperasional({ org }: { org: Org }) {
  const d = detailOf(org)
  const [req, setReq] = useState([true, true, false, true, false])
  const [sent, setSent] = useState(false)
  const items = [
    "MSP masih berlaku",
    "Surat keterangan domisili kantor",
    "NPWP perwakilan di Indonesia",
    "Laporan tahunan terakhir",
    "Rekomendasi K/L mitra",
  ]
  const ready = req.every(Boolean)
  return (
    <>
      <Section
        title="Izin Operasional"
        hint={`Permohonan izin operasional ${org.name} setelah izin prinsip sementara diterbitkan.`}
      >
        <div className="grid grid-cols-2 max-[700px]:grid-cols-1 gap-x-6 gap-y-5">
          <Field label="Jenis permohonan">
            <select className={field}>
              <option>Izin baru</option>
              <option>Perpanjangan</option>
              <option>Perubahan data</option>
            </select>
          </Field>
          <Field label="Nomor izin prinsip">
            <input
              className={field}
              defaultValue={d.izinPrinsip}
              placeholder="Belum diterbitkan"
            />
          </Field>
          <Field label="K/L mitra">
            <input className={field} defaultValue={org.kl} />
          </Field>
          <Field label="Masa berlaku diminta">
            <select className={field}>
              <option>3 tahun</option>
              <option>5 tahun</option>
            </select>
          </Field>
          <Field label="Wilayah operasional" wide>
            <input
              className={field}
              defaultValue={d.wilayah}
              placeholder="Provinsi atau kabupaten wilayah kerja"
            />
          </Field>
        </div>
        <div className={`${glass} mt-6`}>
          {items.map((b, i) => (
            <label
              key={b}
              className="flex items-center gap-3 px-4 py-3 border-b border-slate-200/80 last:border-0 cursor-pointer text-[14px]"
            >
              <input
                type="checkbox"
                className="accent-teal-600 w-4 h-4"
                checked={req[i]}
                onChange={() => setReq(req.map((x, j) => (j === i ? !x : x)))}
              />
              {b}
              <span className="ml-auto font-mono text-[11px] text-muted">
                {req[i] ? "terpenuhi" : "belum"}
              </span>
            </label>
          ))}
        </div>
      </Section>
      {sent ? (
        <Banner tone="ok">
          Permohonan izin operasional terkirim dan menunggu verifikasi (estimasi
          14 hari kerja).
        </Banner>
      ) : (
        <>
          <Btn disabled={!ready} onClick={() => setSent(true)}>
            Ajukan izin operasional
          </Btn>
          {!ready && (
            <span className="ml-3 text-[13px] text-muted">
              Penuhi seluruh persyaratan.
            </span>
          )}
        </>
      )}
    </>
  )
}

const kpi = [
  { k: "Anak penerima manfaat", t: 12000, r: 9400, u: "anak" },
  { k: "Desa dampingan", t: 40, r: 33, u: "desa" },
  { k: "Penyerapan anggaran", t: 100, r: 71, u: "%" },
  { k: "Laporan triwulan tepat waktu", t: 4, r: 3, u: "dari 4" },
]

function Monev({ org }: { org: Org }) {
  const [rek, setRek] = useState("Lanjutkan")
  const [saved, setSaved] = useState(false)
  return (
    <>
      <Section
        title="Monitoring & Evaluasi"
        hint={`Capaian program ${org.name} periode berjalan. Evaluasi dilakukan bersama ${org.kl}.`}
      >
        <div className="grid grid-cols-2 max-[700px]:grid-cols-1 gap-4">
          {kpi.map((x) => {
            const p = Math.round((x.r / x.t) * 100)
            return (
              <div key={x.k} className={`${glass} p-5`}>
                <div className="text-[13px] text-muted">{x.k}</div>
                <div className="font-display text-3xl mt-1">
                  {x.r.toLocaleString("id-ID")}{" "}
                  <span className="text-[14px] text-muted">
                    / {x.t.toLocaleString("id-ID")} {x.u}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-200 mt-4">
                  <div
                    className={`h-full rounded-full ${
                      p < 75 ? "bg-ochre" : "bg-forest"
                    }`}
                    style={{ width: `${p}%` }}
                  />
                </div>
                <div className="font-mono text-[11px] text-muted mt-2">
                  {p}% tercapai
                </div>
              </div>
            )
          })}
        </div>

        <div className={`${glass} mt-6 overflow-x-auto`}>
          <table className="w-full text-[14px] min-w-[560px]">
            <thead>
              <tr className="text-left font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted border-b border-slate-300/70">
                <th className="p-3 font-normal">Laporan</th>
                <th className="p-3 font-normal">Tenggat</th>
                <th className="p-3 font-normal">Status</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Triwulan I 2026", "15 Apr 2026", "Diterima"],
                ["Triwulan II 2026", "15 Jul 2026", "Diterima"],
                ["Triwulan III 2026", "15 Okt 2026", "Menunggu"],
                ["Triwulan IV 2026", "15 Jan 2027", "Belum jatuh tempo"],
              ].map((r) => (
                <tr
                  key={r[0]}
                  className="border-b border-slate-200/80 last:border-0"
                >
                  <td className="p-3">{r[0]}</td>
                  <td className="p-3 font-mono text-[12.5px]">{r[1]}</td>
                  <td className="p-3">
                    <Pill s={r[2] === "Diterima" ? "Aktif" : "Perpanjangan"} />{" "}
                    <span className="text-[12.5px] text-muted ml-1">
                      {r[2]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid grid-cols-2 max-[700px]:grid-cols-1 gap-x-6 gap-y-5 mt-6">
          <Field label="Rekomendasi evaluasi">
            <select
              className={field}
              value={rek}
              onChange={(e) => setRek(e.target.value)}
            >
              <option>Lanjutkan</option>
              <option>Lanjutkan dengan perbaikan</option>
              <option>Peringatan tertulis</option>
            </select>
          </Field>
          <Field label="Tanggal evaluasi">
            <input type="date" className={field} defaultValue="2026-10-15" />
          </Field>
          <Field label="Catatan evaluator" wide>
            <textarea
              rows={3}
              className={field}
              placeholder="Temuan lapangan dan tindak lanjut…"
            />
          </Field>
        </div>
      </Section>
      {saved ? (
        <Banner tone="ok">Hasil evaluasi tersimpan: {rek}.</Banner>
      ) : (
        <Btn onClick={() => setSaved(true)}>Simpan hasil evaluasi</Btn>
      )}
    </>
  )
}

const tabs = [
  "Pendaftaran Awal",
  "Verifikasi & Data Pengajuan",
  "Izin Operasional",
  "Monitoring & Evaluasi",
  "Data Personil",
  "Monitoring Lanjutan",
]
const T_PERSONIL = 4

export default function IngoDashboard() {
  const [orgs, setOrgs] = useState(initialOrgs)
  const [personnel, setPersonnel] = useLocal<Record<string, Person[]>>("tpoa:personil", initialPersonnel)
  const [sel, setSel] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [tab, setTab] = useState(0)
  const org = orgs.find((o) => o.id === sel) ?? null

  const patch = (id: string, k: keyof Org, v: string) =>
    setOrgs(orgs.map((o) => (o.id === id ? { ...o, [k]: v } : o)))

  const countOf = (id: string) => (personnel[id] ?? []).length

  const cols: [keyof Org, string][] = [
    ["name", "Nama INGO"],
    ["country", "Negara asal"],
    ["kl", "K/L mitra awal"],
    ["field", "Bidang"],
    ["funding", "Pendanaan"],
    ["msp", "Masa berlaku MSP"],
  ]

  const stats = [
    { k: "INGO terdaftar", v: orgs.length },
    { k: "MSP aktif", v: orgs.filter((o) => o.status === "Aktif").length },
    {
      k: "Perlu tindak lanjut",
      v: orgs.filter((o) => o.status !== "Aktif").length,
    },
  ]

  return (
    <div>
      <header className="mb-8">
        <div className="flex flex-wrap items-center gap-3">
          <Eyebrow>Data INGO</Eyebrow>
          <span className="px-2 py-0.5 rounded-full border border-primary/25 bg-primary-light/60 font-mono text-[10px] tracking-[0.14em] uppercase text-primary">
            Khusus staf TPOA
          </span>
        </div>
        <h1 className="font-display text-[40px] max-[700px]:text-[30px] leading-[1.1] mt-2 text-gradient">
          Organisasi Asing di Indonesia
        </h1>
        <div className="mt-3">
          <Btn
            variant="ghost"
            onClick={() => {
              addLog({ id: "-", name: "Semua INGO" }, "Data", "Refresh data seluruh tabel")
              bump()
            }}
          >
            ↻ Refresh data
          </Btn>
          <span className="ml-3 text-[12.5px] text-muted">Refresh hanya memuat data baru; isian yang sudah diubah dan disimpan TPOA tidak ditimpa.</span>
        </div>
        <p className="text-muted mt-2 text-[14px] max-w-xl">
          Pilih satu INGO untuk melihat profilnya, lalu buka formulir
          pendaftaran awal, izin operasional, monitoring & evaluasi, dan data
          personil.
        </p>
      </header>

      <div className="grid grid-cols-4 max-[900px]:grid-cols-2 gap-4 mb-8">
        {stats.map((s) => (
          <div key={s.k} className={`${glass} p-4`}>
            <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
              {s.k}
            </div>
            <div className="font-display text-3xl mt-1 text-gradient">
              {s.v}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_340px] max-[1250px]:grid-cols-1 gap-6 items-start">
        <section
          className={`${glass} overflow-x-auto min-w-0 max-[800px]:hidden`}
        >
          <table className="w-full text-[13.5px] min-w-[960px]">
            <thead>
              <tr className="text-left font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted border-b border-slate-300/70">
                {cols.map(([, l]) => (
                  <th key={l} className="p-3 font-normal">
                    {l}
                  </th>
                ))}
                <th className="p-3 font-normal w-24">Personil</th>
                <th className="p-3 font-normal w-24">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {orgs.map((o) => {
                const isEdit = editing === o.id
                return (
                  <tr
                    key={o.id}
                    onClick={() => {
                      if (!isEdit) {
                        setSel(o.id)
                        setTab(0)
                      }
                    }}
                    className={`border-b border-slate-200/80 last:border-0 transition-colors align-top cursor-pointer ${
                      sel === o.id ? "bg-forest-soft" : "hover:bg-white/60"
                    }`}
                  >
                    {cols.map(([k]) => (
                      <td
                        key={k}
                        className="p-3"
                        onClick={(e) => isEdit && e.stopPropagation()}
                      >
                        {isEdit ? (
                          <input
                            className={cell}
                            value={o[k]}
                            onChange={(e) => patch(o.id, k, e.target.value)}
                          />
                        ) : k === "name" ? (
                          <span className="font-semibold">{o.name}</span>
                        ) : k === "msp" ? (
                          <span className="font-mono text-[12px]">{o.msp}</span>
                        ) : (
                          o[k]
                        )}
                      </td>
                    ))}
                    <td
                      className="p-3 whitespace-nowrap"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        className="text-primary text-[13px] font-semibold underline underline-offset-4 cursor-pointer"
                        onClick={() => {
                          setSel(o.id)
                          setTab(T_PERSONIL)
                        }}
                      >
                        {countOf(o.id)} orang
                      </button>
                    </td>
                    <td
                      className="p-3 whitespace-nowrap"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        className="text-forest-deep text-[13px] font-semibold underline underline-offset-4 cursor-pointer"
                        onClick={() => setEditing(isEdit ? null : o.id)}
                      >
                        {isEdit ? "Simpan" : "Edit"}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </section>

        <section className="min-[801px]:hidden space-y-3 min-w-0">
          {orgs.map((o) => {
            const isEdit = editing === o.id
            return (
              <div
                key={o.id}
                onClick={() => {
                  if (!isEdit) {
                    setSel(o.id)
                    setTab(0)
                  }
                }}
                className={`${glass} p-4 cursor-pointer ${
                  sel === o.id ? "border-forest!" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  {isEdit ? (
                    <input
                      className={cell}
                      value={o.name}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => patch(o.id, "name", e.target.value)}
                    />
                  ) : (
                    <div className="font-display text-[17px] leading-tight">
                      {o.name}
                    </div>
                  )}
                  <button
                    className="text-forest-deep text-[13px] font-semibold underline underline-offset-4 shrink-0 cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation()
                      setEditing(isEdit ? null : o.id)
                    }}
                  >
                    {isEdit ? "Simpan" : "Edit"}
                  </button>
                </div>
                <dl className="grid grid-cols-2 gap-x-3 gap-y-3 mt-4 text-[13px]">
                  {cols.slice(1).map(([k, l]) => (
                    <div key={k} className={k === "msp" ? "col-span-2" : ""}>
                      <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
                        {l}
                      </dt>
                      <dd className="mt-0.5">
                        {isEdit ? (
                          <input
                            className={cell}
                            value={o[k]}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => patch(o.id, k, e.target.value)}
                          />
                        ) : (
                          o[k]
                        )}
                      </dd>
                    </div>
                  ))}
                  <div>
                    <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
                      Personil
                    </dt>
                    <dd className="mt-0.5">
                      <button
                        className="text-primary font-semibold underline underline-offset-4 cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation()
                          setSel(o.id)
                          setTab(T_PERSONIL)
                        }}
                      >
                        {countOf(o.id)} orang
                      </button>
                    </dd>
                  </div>
                </dl>
              </div>
            )
          })}
        </section>

        <aside
          className={`${glass} p-6 min-w-0 min-[1251px]:sticky min-[1251px]:top-6`}
        >
          <Eyebrow>Profil INGO</Eyebrow>
          {org ? (
            <>
              <h2 className="font-display text-2xl mt-3 leading-tight">
                {org.name}
              </h2>
              <div className="mt-2">
                <Pill s={org.status} />
              </div>
              <dl className="mt-6 space-y-4 text-[14px]">
                {([
                  ["Nama INGO", org.name],
                  ["Negara asal", org.country],
                  ["K/L mitra awal", org.kl],
                  ["Bidang", org.field],
                  ["Pendanaan", org.funding],
                  ["Masa berlaku MSP", org.msp],
                ] as const).map(([l, v]) => (
                  <div key={l} className="border-t border-slate-200/80 pt-3">
                    <dt className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted">
                      {l}
                    </dt>
                    <dd className="mt-0.5">{v}</dd>
                  </div>
                ))}
              </dl>
            </>
          ) : (
            <p className="text-muted text-[14px] mt-3 leading-relaxed">
              Belum ada INGO dipilih. Klik salah satu baris pada tabel untuk
              menampilkan profilnya di sini.
            </p>
          )}
        </aside>
      </div>

      {org && (
        <section className="mt-10 min-w-0" key={org.id}>
          <div className="mb-1">
            <Eyebrow>Formulir · {org.name}</Eyebrow>
          </div>
          <div
            role="tablist"
            className="flex gap-1 border-b border-slate-300/60 overflow-x-auto"
          >
            {tabs.map((t, i) => (
              <button
                key={t}
                role="tab"
                aria-selected={tab === i}
                onClick={() => setTab(i)}
                className={`px-5 py-3.5 text-[14px] font-semibold whitespace-nowrap border-b-2 cursor-pointer transition-colors ${
                  tab === i
                    ? "border-forest text-forest-deep"
                    : "border-transparent text-muted hover:text-ink"
                }`}
              >
                <span className="font-mono text-[11px] opacity-70 mr-2">
                  0{i + 1}
                </span>
                {t}
              </button>
            ))}
          </div>
          <div className={`${glass} mt-6 p-8 max-[700px]:p-4 min-w-0`}>
            {tab === 0 && <Pendaftaran org={org} />}
            {tab === 1 && (
              <Pengajuan
                orgs={orgs}
                onOpen={(id) => {
                  setSel(id)
                  setTab(0)
                }}
              />
            )}
            {tab === 2 && <IzinOperasional org={org} />}
            {tab === 3 && <Monev org={org} />}
            {tab === 5 && <MonitoringLanjutan orgs={orgs} orgId={org.id} />}
            {tab === T_PERSONIL && (
              <Personil
                org={org}
                rows={personnel[org.id] ?? []}
                source={initialPersonnel[org.id] ?? []}
                onVerified={() => setTab(0)}
                onChange={(rows) =>
                  setPersonnel((prev) => ({ ...prev, [org.id]: rows }))
                }
              />
            )}
          </div>
        </section>
      )}
    </div>
  )
}
