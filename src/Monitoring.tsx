import { useState } from "react"
import { Section, Btn, detailOf, stages, docs, type Org } from "./Ingo"
import { CATS, getLog, getMails, readLS, resendMail, stamp, useVersion, bump, type Cat } from "./store"

const th = "p-3 font-normal"
const head = "text-left font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted border-b border-slate-300/70"

/* Tab baru: Verifikasi & Data Pengajuan, tabel semua INGO dengan tanggal, waktu, dan tahun */
export function Pengajuan({ orgs, onOpen }: { orgs: Org[]; onOpen: (id: string) => void }) {
  useVersion()
  const logs = getLog()
  return (
    <div>
      <Section title="Verifikasi & Data Pengajuan" hint="Ringkasan seluruh pengajuan INGO beserta tanggal, waktu, dan tahun untuk monitoring. Tabel diperbarui otomatis saat TPOA bekerja di tiap tahap.">
        <div className="mb-4"><Btn variant="ghost" onClick={bump}>↻ Refresh data</Btn></div>
        <div className="glass overflow-x-auto">
          <table className="w-full text-[13.5px] min-w-[1100px]">
            <thead>
              <tr className={head}>
                <th className={`${th} w-10`}>No</th><th className={th}>INGO</th><th className={th}>Email diterima</th><th className={th}>Tahun</th>
                <th className={th}>Tahap</th><th className={th}>Verifikasi dokumen</th><th className={th}>Personil</th><th className={th}>Keputusan</th><th className={th}>Pembaruan terakhir</th><th className={`${th} w-16`}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {orgs.map((o, i) => {
                const P = `p:${o.id}:`
                const d = detailOf(o)
                const recv = readLS(P + "recv", d.diterima)
                const status = readLS<string[]>(P + "status", docs.map(() => ""))
                const ok = status.filter((s) => s === "Lengkap").length
                const reached = readLS<number>(P + "reached", 0)
                const keputusan = readLS<string>(P + "keputusan", "")
                const final = readLS<boolean>(P + "final", false)
                const last = logs.find((l) => l.org === o.id)
                const ls = last ? stamp(last.t) : null
                const r = new Date(`${recv}T00:00:00`)
                return (
                  <tr key={o.id} className="border-b border-slate-200/80 last:border-0 align-top">
                    <td className="p-3 font-mono text-muted">{String(i + 1).padStart(2, "0")}</td>
                    <td className="p-3 font-semibold">{o.name}</td>
                    <td className="p-3 font-mono text-[12px]">{stamp(r).tgl}</td>
                    <td className="p-3 font-mono text-[12px]">{r.getFullYear()}</td>
                    <td className="p-3">{stages[Math.min(reached, 4)].title}</td>
                    <td className="p-3"><span className={`inline-block px-2 py-0.5 rounded-full font-mono text-[11px] ${ok === docs.length ? "bg-forest-soft text-forest-deep" : "bg-ochre-soft text-amber-700"}`}>{ok}/{docs.length} lengkap</span></td>
                    <td className="p-3">{readLS(P + "personilOk", false) ? <span className="text-forest-deep">Tervalidasi</span> : <span className="text-muted">Belum</span>}</td>
                    <td className="p-3">{final ? (keputusan === "setuju" ? "Setuju" : "Tolak") : <span className="text-muted">—</span>}</td>
                    <td className="p-3 font-mono text-[12px]">{ls ? <>{ls.tgl}<br />{ls.jam} · {ls.tahun}</> : <span className="text-muted">Belum ada aktivitas</span>}</td>
                    <td className="p-3"><button onClick={() => onOpen(o.id)} className="text-primary text-[13px] font-semibold underline underline-offset-4 cursor-pointer">Buka</button></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  )
}

/* Tab baru: Monitoring Lanjutan */
export function MonitoringLanjutan({ orgs, orgId }: { orgs: Org[]; orgId?: string }) {
  useVersion()
  const [cat, setCat] = useState<Cat | "Semua">("Semua")
  const [only, setOnly] = useState(Boolean(orgId))
  const all = getLog().filter((l) => !only || !orgId || l.org === orgId)
  const rows = all.filter((l) => cat === "Semua" || l.cat === cat)
  const mails = getMails().filter((m) => !only || !orgId || m.org === orgId)
  const name = (id: string) => orgs.find((o) => o.id === id)?.name ?? id
  return (
    <div>
      <Section title="Monitoring Lanjutan" hint="Jejak seluruh aktivitas: data, verifikasi, persetujuan, rapat, pertimbangan, dan surat rekomendasi, lengkap dengan tanggal, jam, dan tahun.">
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <Btn variant="ghost" onClick={bump}>↻ Refresh data</Btn>
          {orgId && (
            <label className="flex items-center gap-2 text-[13px] ml-2 cursor-pointer">
              <input type="checkbox" className="accent-teal-600 w-4 h-4" checked={only} onChange={() => setOnly(!only)} />
              Hanya INGO terpilih
            </label>
          )}
        </div>
        <div className="grid grid-cols-6 max-[1100px]:grid-cols-3 max-[600px]:grid-cols-2 gap-3 mb-5">
          {CATS.map((c) => (
            <button key={c} onClick={() => setCat(cat === c ? "Semua" : c)} className={`glass p-3 text-left cursor-pointer ${cat === c ? "border-forest!" : ""}`}>
              <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">{c}</div>
              <div className="font-display text-2xl mt-1">{all.filter((l) => l.cat === c).length}</div>
            </button>
          ))}
        </div>
        <div className="glass overflow-x-auto">
          <table className="w-full text-[13.5px] min-w-[860px]">
            <thead><tr className={head}><th className={`${th} w-10`}>No</th><th className={th}>Tanggal</th><th className={th}>Jam</th><th className={th}>Tahun</th><th className={th}>INGO</th><th className={th}>Kategori</th><th className={th}>Aktivitas</th></tr></thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-muted">Belum ada aktivitas tercatat. Aktivitas muncul otomatis saat TPOA bekerja pada tiap tahap.</td></tr>}
              {rows.slice(0, 100).map((l, i) => {
                const s = stamp(l.t)
                return (
                  <tr key={l.id} className="border-b border-slate-200/80 last:border-0 align-top">
                    <td className="p-3 font-mono text-muted">{String(i + 1).padStart(2, "0")}</td>
                    <td className="p-3 font-mono text-[12px] whitespace-nowrap">{s.tgl}</td>
                    <td className="p-3 font-mono text-[12px]">{s.jam}</td>
                    <td className="p-3 font-mono text-[12px]">{s.tahun}</td>
                    <td className="p-3">{name(l.org)}</td>
                    <td className="p-3"><span className="px-2 py-0.5 rounded-full bg-forest-soft text-forest-deep font-mono text-[11px]">{l.cat}</span></td>
                    <td className="p-3">{l.aksi}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <h4 className="font-display text-xl mt-10">Kotak keluar email</h4>
        <div className="glass overflow-x-auto mt-3">
          <table className="w-full text-[13.5px] min-w-[760px]">
            <thead><tr className={head}><th className={th}>Waktu</th><th className={th}>INGO</th><th className={th}>Jenis email</th><th className={th}>Kepada</th><th className={th}>Status</th><th className={th}>Aksi</th></tr></thead>
            <tbody>
              {mails.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted">Belum ada email keluar.</td></tr>}
              {mails.map((m) => (
                <tr key={m.id} className="border-b border-slate-200/80 last:border-0">
                  <td className="p-3 font-mono text-[12px]">{stamp(m.t).tgl}<br />{stamp(m.t).jam}</td>
                  <td className="p-3">{m.orgName}</td><td className="p-3">{m.jenis}</td><td className="p-3 break-all">{m.to}</td>
                  <td className="p-3"><span className={`px-2 py-0.5 rounded-full font-mono text-[11px] ${m.status === "Gagal" ? "bg-vermilion-soft text-rose-600" : "bg-forest-soft text-forest-deep"}`}>{m.status}</span><span className="text-[11px] text-muted ml-2">x{m.tries}</span></td>
                  <td className="p-3">{m.status === "Gagal" && <button onClick={() => resendMail(m.id)} className="text-vermilion text-[13px] font-semibold underline underline-offset-4 cursor-pointer">Kirim ulang</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  )
}
