import { useState } from "react"
import { REG_EMAIL, fmt, detailOf, cellInput, Section, Btn, Banner, type Org, type Person } from "./Ingo"
import { addLog, sendMail, MailStatus, useConfirm, SaveBar, stampStr, useLocal } from "./store"
import { markPersonilOk } from "./Pendaftaran"

const izinOpts = ["WNI", "KITAS", "KITAP"]

const personDone = (p: Person) => {
  const needExp = p.izin === "KITAS" || p.izin === "KITAP"
  return Boolean(p.nama.trim() && p.jabatan.trim() && p.negara.trim() && p.email.includes("@") && p.izin && (!needExp || p.berlaku))
}

type Props = {
  org: Org
  rows: Person[]
  source: Person[] // data yang diisi pihak INGO
  onChange: (rows: Person[]) => void
  onVerified: () => void
  showWorkflowValidation?: boolean
}

export function Personil({ org, rows, source, onChange, onVerified, showWorkflowValidation = true }: Props) {
  const ref = { id: org.id, name: org.name }
  const { node, confirm } = useConfirm()
  const [draft, setDraft] = useState<Person[] | null>(null)
  const [savedAt, setSavedAt] = useLocal<number | null>(`p:${org.id}:personSaved`, null)
  const [msg, setMsg] = useState("")
  const editing = draft !== null
  const shown = draft ?? rows
  const done = shown.filter(personDone).length
  const validated = rows.filter((r) => r.valid).length
  const allValid = rows.length > 0 && rows.every((r) => personDone(r) && r.valid) && !editing
  const dirty = editing && JSON.stringify(draft) !== JSON.stringify(rows)
  const inviteTo = detailOf(org).email

  const edit = (id: number, k: keyof Person, v: string) =>
    setDraft((d) => d && d.map((r) => (r.id === id ? { ...r, [k]: v, touched: true, valid: false } : r)))
  const add = () => setDraft((d) => d && [...d, { id: Math.max(0, ...d.map((r) => r.id)) + 1, nama: "", jabatan: "", negara: "", email: "", izin: "", berlaku: "", touched: true }])
  const save = () => {
    if (!draft) return
    onChange(draft)
    setSavedAt(Date.now())
    setDraft(null)
    addLog(ref, "Data", "TPOA menyimpan koreksi data personil")
  }
  // Refresh: ambil isian terbaru dari INGO tanpa menimpa baris yang sudah diubah TPOA.
  const refresh = () => {
    if (editing) return setMsg("Simpan atau batalkan edit dulu sebelum refresh.")
    const next = [...rows]
    let n = 0
    for (const s of source) {
      const i = next.findIndex((r) => r.id === s.id)
      if (i === -1) { next.push({ ...s }); n++ }
      else if (!next[i].touched && JSON.stringify({ ...next[i], valid: 0 }) !== JSON.stringify({ ...s, valid: 0 })) { next[i] = { ...s, valid: next[i].valid }; n++ }
    }
    onChange(next)
    addLog(ref, "Data", `Refresh data personil dari INGO: ${n} baris diperbarui`)
    setMsg(`Data personil diperbarui ${stampStr(Date.now())}: ${n} baris dari INGO. Baris yang diubah TPOA tidak ditimpa.`)
  }
  const toggleValid = (id: number) => {
    onChange(rows.map((r) => (r.id === id ? { ...r, valid: !r.valid } : r)))
    const r = rows.find((x) => x.id === id)
    if (r) addLog(ref, "Persetujuan", `Personil ${r.nama || "(tanpa nama)"} ${r.valid ? "batal divalidasi" : "divalidasi TPOA"}`)
  }
  const validateAll = () => onChange(rows.map((r) => (personDone(r) ? { ...r, valid: true } : r)))

  const askSubject = `Permintaan pengisian data personil — ${org.name}`
  const askBody = `Yth. Perwakilan ${org.name},\n\nMohon melengkapi data personil di Indonesia: nama, jabatan, kewarganegaraan, email, status izin tinggal (WNI/KITAS/KITAP), dan masa berlaku izin.\n\nHormat kami,\nSekretariat TPOA`
  const askHref = `mailto:${inviteTo}?cc=${encodeURIComponent(REG_EMAIL)}&subject=${encodeURIComponent(askSubject)}&body=${encodeURIComponent(askBody)}`

  return (
    <div>
      {node}
      <Section title="Data Personil" hint={`Data personil ${org.name} terisi otomatis dari isian pihak INGO. TPOA cukup memvalidasi tiap baris; edit hanya jika ada kesalahan.`}>
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <Btn variant="ghost" onClick={refresh}>↻ Refresh data</Btn>
          {!editing ? (
            <Btn variant="ghost" onClick={() => setDraft(rows.map((r) => ({ ...r })))}>Edit data</Btn>
          ) : (
            <>
              <Btn disabled={!dirty} onClick={() => confirm("Simpan koreksi data personil?", <>Perubahan data personil {org.name} akan disimpan. Validasi baris yang diubah perlu diulang.</>, "Ya, simpan", save)}>Simpan perubahan</Btn>
              <Btn variant="ghost" onClick={() => setDraft(null)}>Batal</Btn>
            </>
          )}
          <a href={askHref} className="text-[13px] font-semibold text-primary underline underline-offset-4">Minta INGO melengkapi (buka email)</a>
          <span className="ml-auto font-mono text-[12px] text-muted">{shown.length} personil · {done} lengkap · {validated} tervalidasi</span>
        </div>
        <div className="mb-4"><SaveBar dirty={dirty} savedAt={savedAt} /></div>
        {msg && <Banner tone="ok">{msg}</Banner>}
        <MailStatus orgId={org.id} jenis="Permintaan data personil" />
        <div className="mb-4">
          <Btn variant="ghost" onClick={() => sendMail(ref, "Permintaan data personil", inviteTo, "Data")}>Kirim permintaan pengisian ke INGO</Btn>
        </div>

        <div className="glass overflow-x-auto">
          <table className="w-full text-[13.5px] min-w-[1080px]">
            <thead>
              <tr className="text-left font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted border-b border-slate-300/70">
                <th className="p-3 w-10 font-normal">No</th><th className="p-3 font-normal">Nama</th><th className="p-3 font-normal">Jabatan</th><th className="p-3 font-normal">Kewarganegaraan</th><th className="p-3 font-normal">Email</th>
                <th className="p-3 font-normal w-32">Status izin</th><th className="p-3 font-normal w-40">Berlaku s/d</th><th className="p-3 font-normal w-28">Kelengkapan</th><th className="p-3 font-normal w-28">Validasi TPOA</th>{editing && <th className="p-3 font-normal w-16">Aksi</th>}
              </tr>
            </thead>
            <tbody>
              {shown.length === 0 && <tr><td colSpan={10} className="p-6 text-center text-[13.5px] text-muted">Belum ada data dari INGO. Klik Refresh data atau minta INGO mengisi.</td></tr>}
              {shown.map((r, i) => (
                <tr key={r.id} className="border-b border-slate-200/80 last:border-0 align-top">
                  <td className="p-3 font-mono text-muted">{String(i + 1).padStart(2, "0")}</td>
                  {(["nama", "jabatan", "negara", "email"] as const).map((k) => (
                    <td key={k} className="p-2"><input className={`${cellInput} ${editing ? "" : "bg-slate-100/80!"}`} readOnly={!editing} value={r[k]} onChange={(e) => edit(r.id, k, e.target.value)} /></td>
                  ))}
                  <td className="p-2">
                    <select className={cellInput} disabled={!editing} value={r.izin} onChange={(e) => edit(r.id, "izin", e.target.value)}>
                      <option value="">Pilih…</option>{izinOpts.map((o) => <option key={o}>{o}</option>)}
                    </select>
                  </td>
                  <td className="p-2"><input type="date" className={cellInput} value={r.berlaku} disabled={!editing || r.izin === "WNI"} onChange={(e) => edit(r.id, "berlaku", e.target.value)} /></td>
                  <td className="p-3"><span className={`inline-block px-2 py-0.5 rounded-full font-mono text-[11px] ${personDone(r) ? "text-forest-deep bg-forest-soft" : "text-amber-700 bg-ochre-soft"}`}>{personDone(r) ? "Lengkap" : "Belum"}</span></td>
                  <td className="p-3">
                    <label className="inline-flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" className="accent-teal-600 w-4 h-4" disabled={editing || !personDone(r)} checked={Boolean(r.valid)} onChange={() => toggleValid(r.id)} />
                      <span className="text-[12px] text-muted">{r.valid ? "Valid" : "—"}</span>
                    </label>
                  </td>
                  {editing && <td className="p-3"><button className="text-vermilion text-[13px] font-semibold underline underline-offset-4 cursor-pointer" onClick={() => setDraft((d) => d && d.filter((x) => x.id !== r.id))}>Hapus</button></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
      <div className="flex flex-wrap items-center gap-3">
        {editing && <Btn onClick={add}>Tambah personil</Btn>}
        {showWorkflowValidation && !editing && <Btn variant="ghost" disabled={rows.length === 0} onClick={validateAll}>Validasi semua yang lengkap</Btn>}
        {showWorkflowValidation && <Btn disabled={!allValid} onClick={() => confirm("Verifikasi data personil dan kembali ke Data Pengajuan?", <>{rows.length} personil sudah lengkap dan divalidasi. Sistem akan membuka tahap Verifikasi pada tab Pendaftaran Awal. Tanggal: {fmt(new Date())}.</>, "Ya, sudah sesuai", () => { markPersonilOk(org.id); addLog(ref, "Persetujuan", `Data personil ${rows.length} orang diverifikasi TPOA`); onVerified() })}>
          Verifikasi sesuai · kembali ke Data Pengajuan
        </Btn>}
        {showWorkflowValidation && !allValid && !editing && <span className="text-[13px] text-muted">Seluruh personil harus lengkap dan tervalidasi.</span>}
      </div>
    </div>
  )
}
