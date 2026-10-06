import { useEffect, useRef, useState, type DragEvent } from "react"
import {
  REG_EMAIL, fmt, parseISO, addBusinessDays, businessDaysUntil, sizeLabel, stages, docs, klList, klEmail, fileKinds,
  bidangList, materiList, kriteria, detailOf, field, cellInput, Field, Section, Btn, Banner, Meta,
  type Org, type Form, type Letter, type Attach, type FieldEvent,
} from "./Ingo"
import {
  useLocal, readLS, writeLS, addLog, sendMail, MailStatus, useConfirm, DocModal, SaveBar, stampStr, stamp, bump, type DocRef,
} from "./store"

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"]

// Isi surat dibuat otomatis oleh sistem dari data pengajuan, verifikasi, rapat, dan pertimbangan.
function genBody(o: { org: string; kl: string; f: Form; ok: number; avg: string; alasan: string; ip: string }) {
  const tgl = stamp().tgl
  return `Jakarta, ${tgl}

Yth. Menteri/Kepala ${o.kl}

Perihal: Rekomendasi kemitraan ${o.org} — Surat Izin Prinsip Sementara

Berdasarkan hasil verifikasi ${o.ok} dari ${docs.length} dokumen persyaratan, rapat pemaparan (skor rata-rata ${o.avg} dari 5), dan pertimbangan TPOA, permohonan INGO ${o.org} (${o.f.negara}) dinyatakan layak dilanjutkan.

Ringkasan program: ${o.f.ringkasan || "—"}
Bidang: ${o.f.bidang} · Wilayah kerja: ${o.f.wilayah || "—"} · Durasi: ${o.f.durasi || "—"}
Penanggung jawab: ${o.f.pj || "—"}
Dasar pertimbangan: ${o.alasan || "—"}

Bersama surat ini kami sampaikan Surat Izin Prinsip Sementara Nomor ${o.ip} sebagai dasar penjajakan kemitraan dengan ${o.kl}.

Atas perhatian dan kerja sama Bapak/Ibu, kami ucapkan terima kasih.

Hormat kami,
Ketua TPOA`
}

export function Pendaftaran({ org, standaloneLetter = false }: { org: Org; standaloneLetter?: boolean }) {
  const d = detailOf(org)
  const P = `p:${org.id}:`
  const klDefault = klList.includes(org.kl) ? org.kl : klList[0]
  const ref = { id: org.id, name: org.name }
  const { node, confirm } = useConfirm()
  const [viewDoc, setViewDoc] = useState<DocRef | null>(null)

  const [reached, setReached] = useLocal(P + "reached", 0)
  const [view, setView] = useLocal(P + (standaloneLetter ? "suratView" : "view"), standaloneLetter ? 4 : 0)
  const go = (i: number) => {
    setReached((r) => Math.max(r, i))
    setView(i)
  }

  /* 1 · pengajuan awal: terisi otomatis dari email INGO */
  const inbox = (): Form => ({
    nama: org.name, negara: org.country, tahun: d.tahun, bidang: org.field, pj: d.pj, email: d.email,
    alamat: d.alamat, wilayah: d.wilayah, durasi: d.durasi, kl: klDefault, ringkasan: d.ringkasan,
  })
  const [form, setForm] = useLocal<Form>(P + "form", inbox())
  const [edited, setEdited] = useLocal<string[]>(P + "edited", []) // field yang sudah diubah & disimpan TPOA
  const [receivedAt, setReceivedAt] = useLocal(P + "recv", d.diterima)
  const [savedAt, setSavedAt] = useLocal<number | null>(P + "savedAt", null)
  const [draft, setDraft] = useState<Form | null>(null) // null = tidak sedang mengedit
  const [syncAt, setSyncAt] = useLocal<number | null>(P + "syncAt", null)
  const [msg, setMsg] = useState("")
  const editing = draft !== null
  const shown = draft ?? form
  const dirty = editing && JSON.stringify(draft) !== JSON.stringify(form)
  const bind = (k: keyof Form) => ({
    value: shown[k],
    readOnly: !editing,
    disabled: !editing && k === "bidang",
    onChange: (e: FieldEvent) => setDraft((f) => (f ? { ...f, [k]: e.target.value } : f)),
  })
  const ro = (on: boolean) => (on ? "" : "bg-slate-100/80! text-slate-700")

  // Muat otomatis: email pengajuan masuk dan data terisi sendiri; dicatat sekali saja.
  useEffect(() => {
    if (readLS<number | null>(P + "syncAt", null) === null) {
      const t = Date.now()
      writeLS(P + "syncAt", t)
      setSyncAt(t)
      addLog(ref, "Data", `Email pengajuan awal dari INGO masuk ke ${REG_EMAIL}; data terisi otomatis`)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  // Refresh: ambil data terbaru dari email INGO, tetapi tidak menimpa field yang sudah diubah TPOA.
  const refresh = () => {
    if (editing) return setMsg("Simpan atau batalkan edit dulu sebelum refresh.")
    const src = inbox() as unknown as Record<string, string>
    const next = { ...form } as unknown as Record<string, string>
    let n = 0
    for (const k of Object.keys(src)) if (!edited.includes(k) && next[k] !== src[k]) { next[k] = src[k]; n++ }
    setForm(next as unknown as Form)
    setSyncAt(Date.now())
    addLog(ref, "Data", `Refresh data: ${n} field diperbarui, ${edited.length} field hasil edit TPOA dipertahankan`)
    setMsg(`Data diperbarui ${stampStr(Date.now())}. ${n} field baru, ${edited.length} field hasil edit TPOA tidak diubah.`)
  }
  const saveForm = () => {
    if (!draft) return
    const changed = (Object.keys(draft) as (keyof Form)[]).filter((k) => draft[k] !== form[k])
    setForm(draft)
    setEdited((e) => [...new Set([...e, ...changed])])
    setSavedAt(Date.now())
    setDraft(null)
    addLog(ref, "Data", `TPOA mengoreksi data pengajuan: ${changed.join(", ") || "tanpa perubahan"}`)
    setMsg("")
  }

  /* 2 · verifikasi */
  const [status, setStatus] = useLocal<string[]>(P + "status", docs.map(() => "Belum diperiksa"))
  const [notes, setNotes] = useLocal<string[]>(P + "notes", docs.map(() => ""))
  const [deadline, setDeadline] = useLocal<number | null>(P + "deadline", null)
  const [sentTo, setSentTo] = useLocal(P + "sentTo", "")
  const [mailTo, setMailTo] = useState<string | null>(null)
  const [extra, setExtra] = useState(
    "Mohon dokumen dilengkapi dalam 30 hari sejak email ini dikirim. Jika batas waktu terlewati, permohonan dibekukan.",
  )
  const setSt = (i: number, v: string) => {
    setStatus(status.map((s, j) => (j === i ? v : s)))
    addLog(ref, "Verifikasi", `Dokumen "${docs[i].n}" ditandai: ${v}`)
  }
  const personilOk = readLS<boolean>(P + "personilOk", false)
  const incomplete = status.filter((s) => s !== "Lengkap").length
  const unchecked = status.filter((s) => s === "Belum diperiksa").length
  const daysLeft = deadline ? Math.max(0, Math.ceil((deadline - Date.now()) / 86400000)) : 0
  const received = parseISO(receivedAt)
  const recvOk = !Number.isNaN(received.getTime())
  const slaDate = recvOk ? addBusinessDays(received, 14) : null
  const slaLeft = slaDate ? businessDaysUntil(slaDate) : 0
  const toEmail = mailTo ?? form.email
  const lengkapi = docs.map((x, i) => ({ x, i })).filter(({ i }) => status[i] !== "Lengkap")
  const mailSubject = `Permohonan kelengkapan dokumen pendaftaran INGO — ${org.name}`
  const mailBody = `Yth. ${form.pj || `Perwakilan ${org.name}`},\n\nTPOA Kementerian Luar Negeri telah memeriksa dokumen pendaftaran ${org.name}. Dokumen berikut perlu dilengkapi:\n\n${lengkapi.map(({ x, i }, n) => `${n + 1}. ${x.n}${notes[i].trim() ? ` — ${notes[i].trim()}` : ""}`).join("\n")}\n\n${extra}\n\nHormat kami,\nSekretariat TPOA`
  const mailHref = `mailto:${toEmail}?cc=${encodeURIComponent(REG_EMAIL)}&subject=${encodeURIComponent(mailSubject)}&body=${encodeURIComponent(mailBody)}`

  /* 3 · rapat */
  const [rapat, setRapat] = useLocal(P + "rapat", {
    tgl: "2026-10-22", jam: "10.00", tempat: "Ruang Rapat Utama, Lt. 5",
    peserta: "Tim TPOA, perwakilan INGO, calon K/L mitra", agenda: `Pemaparan program ${org.name}`,
  })
  const [invited, setInvited] = useLocal(P + "invited", false)
  const [materi, setMateri] = useLocal(P + "materi", [true, true, false, false])
  const [skor, setSkor] = useLocal(P + "skor", [4, 4, 3, 5])
  const [pemaparan, setPemaparan] = useLocal(P + "pemaparan", "")
  const avg = (skor.reduce((a, b) => a + b, 0) / skor.length).toFixed(1)

  /* 4 · pertimbangan */
  const [keputusan, setKeputusan] = useLocal<"" | "setuju" | "tolak">(P + "keputusan", "")
  const [alasan, setAlasan] = useLocal(P + "alasan", "")
  const [final, setFinal] = useLocal(P + "final", false)
  const [notifSent, setNotifSent] = useLocal(P + "notif", false)
  const rejected = final && keputusan === "tolak"

  /* 5 · surat rekomendasi (isi otomatis dari sistem) */
  const ipNo = d.izinPrinsip || `IP-S/${String(100 + Math.abs(org.id.length * 37)).padStart(4, "0")}/${new Date().getFullYear()}`
  const now = new Date()
  const gen = (kl: string) =>
    genBody({ org: org.name, kl, f: form, ok: status.filter((s) => s === "Lengkap").length, avg, alasan, ip: ipNo })
  const [letter, setLetter] = useLocal<Letter>(P + "letter", {
    kl: klDefault, to: klEmail[klDefault] ?? "", cc: null,
    nomor: `B-${200 + org.id.length * 7}/TPOA/${ROMAN[now.getMonth()]}/${now.getFullYear()}`,
    perihal: `Rekomendasi kemitraan ${org.name} — Surat Izin Prinsip Sementara`, body: "",
  })
  const [bodyEdited, setBodyEdited] = useLocal(P + "bodyEdited", false)
  const body = bodyEdited || letter.body ? letter.body : gen(letter.kl)
  const setL = (k: keyof Letter) => (e: FieldEvent) => setLetter((l) => ({ ...l, [k]: e.target.value }))
  const changeKl = (kl: string) => {
    setLetter((l) => ({ ...l, kl, to: klEmail[kl] ?? l.to, body: bodyEdited ? l.body.split(l.kl).join(kl) : "" }))
  }
  const regen = () => {
    setLetter((l) => ({ ...l, body: gen(l.kl) }))
    setBodyEdited(false)
  }
  const [files, setFiles] = useState<Attach[]>([])
  const [over, setOver] = useState(false)
  const [sent, setSent] = useLocal(P + "sent", false)
  const inputRef = useRef<HTMLInputElement>(null)
  const idRef = useRef(0)
  const ccValue = letter.cc ?? form.email
  const canSend = letter.to.includes("@")
  const addFiles = (list: FileList | null) => {
    if (!list?.length) return
    setFiles((p) => [...p, ...Array.from(list).map((file) => ({ id: ++idRef.current, file, kind: fileKinds[1] }))])
  }
  const printLetter = () => {
    addLog(ref, "Surat Rekomendasi", `Surat izin prinsip sementara ${ipNo} dicetak`)
    window.print()
  }

  const statusOf = (i: number) => (i === stages.length - 1 ? "soon" : i < reached ? "done" : i === reached ? "active" : "locked")

  const docTable = (withNotes: boolean) => (
    <div className="glass overflow-x-auto">
      <table className="w-full text-[14px] min-w-[860px]">
        <thead>
          <tr className="text-left font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted border-b border-slate-300/70">
            <th className="p-3 w-10 font-normal">No</th>
            <th className="p-3 font-normal">Syarat dokumen</th>
            <th className="p-3 font-normal">Ketentuan yang dicek</th>
            <th className="p-3 w-24 font-normal">Lampiran</th>
            <th className="p-3 w-44 font-normal">Status</th>
            {withNotes && <th className="p-3 w-[260px] font-normal">Catatan TPOA</th>}
          </tr>
        </thead>
        <tbody>
          {docs.map((x, i) => (
            <tr key={x.n} className="border-b border-slate-200/80 last:border-0 align-top">
              <td className="p-3 font-mono text-muted">{String(i + 1).padStart(2, "0")}</td>
              <td className="p-3 font-medium">{x.n}</td>
              <td className="p-3 text-[13px] text-muted">{x.syarat}</td>
              <td className="p-3">
                <button onClick={() => setViewDoc(x)} className="font-mono text-[11.5px] text-forest-deep underline underline-offset-2 text-left cursor-pointer">
                  {x.f}
                  <span className="block text-[10px] text-muted no-underline">✓ ada · klik buka</span>
                </button>
              </td>
              <td className="p-3">
                <select
                  value={status[i]}
                  onChange={(e) => setSt(i, e.target.value)}
                  className={`${field} ${status[i] === "Lengkap" ? "bg-forest-soft!" : status[i] === "Belum lengkap" ? "bg-vermilion-soft!" : ""}`}
                >
                  <option value="Belum diperiksa">Belum diperiksa</option>
                  <option value="Lengkap">Sesuai / lengkap</option>
                  <option value="Belum lengkap">Tidak sesuai</option>
                </select>
              </td>
              {withNotes && (
                <td className="p-3">
                  <textarea rows={2} value={notes[i]} onChange={(e) => setNotes(notes.map((n, j) => (j === i ? e.target.value : n)))} placeholder="Catatan untuk dokumen ini…" className={field} />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )

  return (
    <div>
      {node}
      <DocModal doc={viewDoc} org={org.name} onClose={() => setViewDoc(null)} />

      {/* area cetak: surat izin prinsip sementara */}
      <div id="print-area" className="print-only" style={{ fontFamily: "Georgia, serif", color: "#000" }}>
        <div style={{ textAlign: "center", borderBottom: "2px solid #000", paddingBottom: 8, marginBottom: 16 }}>
          <div style={{ fontWeight: 700 }}>KEMENTERIAN LUAR NEGERI REPUBLIK INDONESIA</div>
          <div>Tim Penilai Organisasi Asing (TPOA)</div>
        </div>
        <div style={{ textAlign: "center", fontWeight: 700, textDecoration: "underline" }}>SURAT IZIN PRINSIP SEMENTARA</div>
        <div style={{ textAlign: "center", marginBottom: 16 }}>Nomor: {ipNo}</div>
        <div>Nomor surat: {letter.nomor}</div>
        <div>Perihal: {letter.perihal}</div>
        <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", marginTop: 16, lineHeight: 1.6 }}>{body}</pre>
      </div>

      {!standaloneLetter && <ol className="flex overflow-x-auto border-b border-slate-300/60">
        {stages.map((s, i) => {
          const st = statusOf(i)
          const bad = rejected && i === 3
          return (
            <li key={s.title} className="flex-1 min-w-[132px]">
              <button
                disabled={st === "locked"}
                onClick={() => setView(i)}
                className={`w-full text-left px-3 py-4 border-b-[3px] transition-colors cursor-pointer disabled:cursor-not-allowed ${view === i ? "border-forest" : "border-transparent"} ${st === "locked" ? "opacity-45" : "hover:bg-white/50"}`}
              >
                <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full font-mono text-[11px] mb-2 ${bad ? "bg-vermilion text-white" : st === "done" ? "bg-forest text-white" : st === "active" ? "border-2 border-forest text-forest-deep shadow-[0_0_10px_rgba(20,184,166,0.45)]" : st === "soon" ? "border border-dashed border-primary text-primary" : "border border-slate-400 text-muted"}`}>
                  {bad ? "✕" : st === "done" ? "✓" : i + 1}
                </span>
                <span className="block text-[13.5px] font-semibold leading-tight">{s.title}</span>
                <span className="block text-[11.5px] text-muted mt-0.5">{s.by}</span>
              </button>
            </li>
          )
        })}
      </ol>}

      <div className="mt-10 max-w-5xl">
        {/* 1 · PENGAJUAN AWAL */}
        {view === 0 && (
          <>
            <Section title="Pengajuan Awal" hint={`Email dari INGO ke ${REG_EMAIL} masuk otomatis ke TPOA, dan datanya terisi sendiri oleh sistem. TPOA hanya mengoreksi bila ada yang salah.`}>
              <div className="glass overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 border-b border-slate-200/80 bg-white/50">
                  <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">Kotak masuk · {REG_EMAIL}</div>
                  <span className="px-2 py-0.5 rounded-full bg-forest-soft font-mono text-[10.5px] text-forest-deep">Masuk otomatis · {syncAt ? stampStr(syncAt) : ""}</span>
                </div>
                <div className="p-5 grid grid-cols-2 max-[700px]:grid-cols-1 gap-x-6 gap-y-3 text-[14px]">
                  <div><span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted">Dari </span>{form.pj ? `${form.pj} · ` : ""}{form.email || "—"}</div>
                  <div><span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted">Kepada </span>{REG_EMAIL}</div>
                  <div className="col-span-2 max-[700px]:col-span-1"><span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted">Subjek </span><strong>Permohonan Pendaftaran INGO — {org.name}</strong></div>
                  <div className="col-span-2 max-[700px]:col-span-1 border-t border-slate-200/80 pt-3 leading-relaxed">
                    Kepada Yth. Tim Kerja TPOA, bersama email ini kami mengajukan permohonan pendaftaran {org.name} sebagai organisasi asing di Indonesia. Dokumen pendukung kami lampirkan.
                    <br />Hormat kami, {form.pj || "perwakilan INGO"}
                  </div>
                  <div className="col-span-2 max-[700px]:col-span-1">
                    <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted mb-2">Lampiran · {docs.length} berkas · klik untuk membuka</div>
                    <div className="flex flex-wrap gap-2">
                      {docs.map((x) => (
                        <button key={x.f} onClick={() => setViewDoc(x)} className="px-2.5 py-1 rounded-md border border-slate-300/70 bg-white/70 font-mono text-[11.5px] text-forest-deep hover:border-forest cursor-pointer">{x.f}</button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </Section>

            <Section title="Data Pengajuan Awal" hint="Terisi otomatis dari email dan lampiran INGO. Klik Edit hanya jika ada kesalahan, lalu Simpan.">
              <div className="flex flex-wrap items-center gap-3 mb-5">
                <Btn variant="ghost" onClick={refresh}>↻ Refresh data</Btn>
                {!editing ? (
                  <Btn variant="ghost" onClick={() => setDraft({ ...form })}>Edit data</Btn>
                ) : (
                  <>
                    <Btn disabled={!dirty} onClick={() => confirm("Simpan koreksi data pengajuan?", <>Perubahan pada data pengajuan {org.name} akan disimpan dan dicatat di monitoring.</>, "Ya, simpan", saveForm)}>Simpan perubahan</Btn>
                    <Btn variant="ghost" onClick={() => setDraft(null)}>Batal</Btn>
                  </>
                )}
                <SaveBar dirty={dirty} savedAt={savedAt} onSave={() => confirm("Simpan koreksi data pengajuan?", <>Perubahan akan disimpan.</>, "Ya, simpan", saveForm)} />
              </div>
              {msg && <Banner tone="ok">{msg}</Banner>}
              {edited.length > 0 && <p className="text-[12.5px] text-muted mb-4">Field hasil koreksi TPOA (tidak ditimpa refresh): <span className="font-mono">{edited.join(", ")}</span></p>}
              <div className="grid grid-cols-2 max-[700px]:grid-cols-1 gap-x-6 gap-y-5">
                <Field label="Tanggal email diterima"><input type="date" className={`${field} ${ro(editing)}`} value={receivedAt} disabled={!editing} onChange={(e) => setReceivedAt(e.target.value)} /></Field>
                <Field label="Nama organisasi"><input className={`${field} ${ro(editing)}`} {...bind("nama")} /></Field>
                <Field label="Negara asal"><input className={`${field} ${ro(editing)}`} {...bind("negara")} /></Field>
                <Field label="Tahun berdiri"><input className={`${field} ${ro(editing)}`} {...bind("tahun")} /></Field>
                <Field label="Bidang kegiatan">
                  <select className={`${field} ${ro(editing)}`} value={shown.bidang} disabled={!editing} onChange={(e) => setDraft((f) => (f ? { ...f, bidang: e.target.value } : f))}>
                    {bidangList.map((b) => <option key={b}>{b}</option>)}
                  </select>
                </Field>
                <Field label="Penanggung jawab"><input className={`${field} ${ro(editing)}`} {...bind("pj")} /></Field>
                <Field label="Email resmi INGO"><input className={`${field} ${ro(editing)}`} placeholder="nama@organisasi.org" {...bind("email")} /></Field>
                <Field label="Alamat kantor di Indonesia" wide><input className={`${field} ${ro(editing)}`} {...bind("alamat")} /></Field>
                <Field label="Wilayah kerja"><input className={`${field} ${ro(editing)}`} {...bind("wilayah")} /></Field>
                <Field label="Durasi program"><input className={`${field} ${ro(editing)}`} {...bind("durasi")} /></Field>
                <Field label="Calon K/L mitra" wide>
                  <select className={`${field} ${ro(editing)}`} value={shown.kl} disabled={!editing} onChange={(e) => setDraft((f) => (f ? { ...f, kl: e.target.value } : f))}>
                    {klList.map((k) => <option key={k}>{k}</option>)}
                  </select>
                </Field>
                <Field label="Ringkasan program" wide><textarea rows={4} className={`${field} ${ro(editing)}`} {...bind("ringkasan")} /></Field>
              </div>
            </Section>

            <Section title="Syarat Dokumen yang Harus Dilengkapi" hint="Buka tiap lampiran dari INGO, cek kesesuaiannya dengan ketentuan, lalu tetapkan status.">
              {docTable(false)}
            </Section>
            <div className="flex flex-wrap items-center gap-3">
              <Btn disabled={!recvOk || editing} onClick={() => confirm("Mulai verifikasi dokumen?", <>Data pengajuan {org.name} dan status {docs.length} dokumen akan dibawa ke tahap Verifikasi.</>, "Ya, mulai verifikasi", () => { addLog(ref, "Verifikasi", "Verifikasi dokumen dimulai"); go(1) })}>Mulai verifikasi dokumen</Btn>
              {editing && <span className="text-[13px] text-muted">Simpan atau batalkan edit dulu.</span>}
            </div>
          </>
        )}

        {/* 2 · VERIFIKASI */}
        {view === 1 && (
          <>
            <Section title="Verifikasi Dokumen oleh TPOA" hint="TPOA memeriksa kelengkapan dokumen dalam 14 hari kerja sejak email diterima. Status di sini sama dengan tabel syarat pada Pengajuan Awal.">
              {personilOk && <Banner tone="ok">Data personil {org.name} sudah divalidasi TPOA dan sesuai.</Banner>}
              <div className="glass px-5 py-4 mb-6 flex flex-wrap items-center gap-x-10 gap-y-3">
                <Meta label="Email diterima">{recvOk ? fmt(received) : "—"}</Meta>
                <Meta label="Batas verifikasi (14 hari kerja)">{slaDate ? fmt(slaDate) : "—"}</Meta>
                <Meta label="Sisa waktu">
                  {slaDate ? <span className={slaLeft < 0 ? "text-vermilion" : slaLeft <= 3 ? "text-amber-600" : "text-forest-deep"}>{slaLeft < 0 ? `Terlambat ${-slaLeft} hari kerja` : `${slaLeft} hari kerja`}</span> : "—"}
                </Meta>
                <div className="text-[12px] text-muted max-w-xs">Hari kerja Senin–Jumat; libur nasional belum dihitung.</div>
              </div>
              {docTable(true)}
            </Section>

            <MailStatus orgId={org.id} jenis="Kelengkapan dokumen" />
            {deadline && incomplete > 0 && (
              <Banner tone="warn">
                <strong>Email permintaan kelengkapan dikirim ke {sentTo}.</strong> INGO wajib melengkapi dalam 30 hari, sampai <strong>{fmt(new Date(deadline))}</strong> (sisa <strong>{daysLeft} hari</strong>). {incomplete} dokumen masih perlu dilengkapi.
              </Banner>
            )}

            {incomplete === 0 ? (
              <>
                <Banner tone="ok">Seluruh dokumen dinyatakan lengkap. Permohonan dapat dilanjutkan ke rapat pemaparan.</Banner>
                <Btn onClick={() => confirm("Lanjut ke rapat pemaparan?", <>Seluruh {docs.length} dokumen berstatus lengkap/sesuai.</>, "Ya, lanjutkan", () => { addLog(ref, "Verifikasi", "Seluruh dokumen lengkap; verifikasi selesai"); go(2) })}>Lanjut ke rapat pemaparan</Btn>
              </>
            ) : (
              <>
                {unchecked > 0 && <p className="text-[13px] text-muted">{unchecked} dokumen belum diperiksa. Selesaikan pemeriksaan untuk membuka email kelengkapan ke INGO.</p>}
                {unchecked === 0 && !deadline && (
                  <div className="glass p-6">
                    <h4 className="font-display text-xl">Kirim email kelengkapan ke INGO</h4>
                    <p className="text-[13.5px] text-muted mt-1">{incomplete} dokumen belum lengkap. INGO diberi waktu 30 hari untuk melengkapi.</p>
                    <div className="grid grid-cols-2 max-[700px]:grid-cols-1 gap-x-6 gap-y-4 mt-5">
                      <Field label="Kepada"><input className={field} value={toEmail} onChange={(e) => setMailTo(e.target.value)} placeholder="email INGO" /></Field>
                      <Field label="Tembusan"><input className={field} value={REG_EMAIL} readOnly /></Field>
                      <Field label="Pesan tambahan" wide><textarea rows={2} className={field} value={extra} onChange={(e) => setExtra(e.target.value)} /></Field>
                    </div>
                    <div className="mt-4 rounded-lg border border-slate-300/70 bg-white/70 p-4">
                      <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted">Subjek: {mailSubject}</div>
                      <pre className="mt-3 whitespace-pre-wrap font-sans text-[13.5px] leading-relaxed">{mailBody}</pre>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 mt-5">
                      <Btn disabled={!toEmail.includes("@")} onClick={() => confirm("Kirim email kelengkapan ke INGO?", <><div>Kepada: {toEmail}</div><div>Cc: {REG_EMAIL}</div><pre className="whitespace-pre-wrap font-sans mt-2">{mailBody}</pre></>, "Ya, kirim email", () => { setDeadline(Date.now() + 30 * 86400000); setSentTo(toEmail); sendMail(ref, "Kelengkapan dokumen", toEmail, "Verifikasi") })}>Kirim email ke INGO</Btn>
                      <a href={mailHref} className="text-[13px] font-semibold text-primary underline underline-offset-4">Buka di aplikasi email</a>
                    </div>
                  </div>
                )}
                {deadline && <Btn variant="ghost" onClick={() => setStatus(docs.map(() => "Lengkap"))}>Simulasi: INGO telah melengkapi</Btn>}
              </>
            )}
          </>
        )}

        {/* 3 · RAPAT */}
        {view === 2 && (
          <>
            <Section title="Rapat Pemaparan INGO" hint="Dokumen telah terverifikasi. TPOA mengadakan rapat bersama INGO untuk pemaparan lengkap, lalu menilai hasilnya.">
              <div className="grid grid-cols-2 max-[700px]:grid-cols-1 gap-x-6 gap-y-5">
                <Field label="Tanggal rapat"><input type="date" className={field} value={rapat.tgl} onChange={(e) => setRapat({ ...rapat, tgl: e.target.value })} /></Field>
                <Field label="Jam"><input className={field} value={rapat.jam} onChange={(e) => setRapat({ ...rapat, jam: e.target.value })} /></Field>
                <Field label="Tempat atau tautan rapat" wide><input className={field} value={rapat.tempat} onChange={(e) => setRapat({ ...rapat, tempat: e.target.value })} /></Field>
                <Field label="Peserta" wide><input className={field} value={rapat.peserta} onChange={(e) => setRapat({ ...rapat, peserta: e.target.value })} /></Field>
                <Field label="Agenda" wide><input className={field} value={rapat.agenda} onChange={(e) => setRapat({ ...rapat, agenda: e.target.value })} /></Field>
              </div>
              <div className="mt-5"><MailStatus orgId={org.id} jenis="Undangan rapat" /></div>
              <div className="flex flex-wrap items-center gap-3 mt-2">
                <Btn variant="ghost" disabled={invited || !form.email.includes("@")} onClick={() => confirm("Kirim undangan rapat ke INGO?", <><div>Kepada: {form.email}</div><div>{rapat.tgl} · {rapat.jam} · {rapat.tempat}</div><div>{rapat.agenda}</div></>, "Ya, kirim undangan", () => { setInvited(true); sendMail(ref, "Undangan rapat", form.email, "Rapat") })}>
                  {invited ? "Undangan dibuat" : "Kirim undangan rapat ke INGO"}
                </Btn>
              </div>
              <div className="glass mt-6">
                {materiList.map((b, i) => (
                  <label key={b} className="flex items-center gap-3 px-4 py-3 border-b border-slate-200/80 last:border-0 cursor-pointer text-[14px]">
                    <input type="checkbox" className="accent-teal-600 w-4 h-4" checked={materi[i]} onChange={() => setMateri(materi.map((x, j) => (j === i ? !x : x)))} />
                    {b}<span className="ml-auto font-mono text-[11px] text-muted">{materi[i] ? "diterima" : "belum"}</span>
                  </label>
                ))}
              </div>
              <h4 className="font-display text-xl mt-8">Penilaian pemaparan</h4>
              <div className="glass mt-3">
                {kriteria.map((k, i) => (
                  <div key={k} className="flex flex-wrap items-center gap-4 px-4 py-3 border-b border-slate-200/80 last:border-0 text-[14px]">
                    <span className="flex-1 min-w-[200px]">{k}</span>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button key={n} onClick={() => setSkor(skor.map((s, j) => (j === i ? n : s)))} className={`w-9 h-9 rounded-md font-mono text-[13px] border cursor-pointer transition-colors ${skor[i] === n ? "bg-forest text-white border-forest" : "border-slate-300 bg-white/60 hover:border-forest"}`}>{n}</button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-5"><Field label="Catatan TPOA atas pemaparan" wide><textarea rows={4} className={field} value={pemaparan} onChange={(e) => setPemaparan(e.target.value)} placeholder="Tanggapan, pertanyaan, atau syarat tambahan…" /></Field></div>
              <div className="mt-4 font-display text-xl">Skor rata-rata: {avg} / 5</div>
            </Section>
            <div className="flex flex-wrap items-center gap-3">
              <Btn disabled={materi.some((m) => !m)} onClick={() => confirm("Rapat selesai, lanjut ke pertimbangan?", <>Skor rata-rata {avg}/5. Catatan: {pemaparan || "—"}</>, "Ya, lanjutkan", () => { addLog(ref, "Rapat", `Rapat pemaparan ${rapat.tgl} ${rapat.jam} selesai, skor ${avg}/5`); go(3) })}>Rapat selesai, lanjut ke pertimbangan</Btn>
              {materi.some((m) => !m) && <span className="text-[13px] text-muted">Seluruh materi pemaparan harus diterima.</span>}
            </div>
          </>
        )}

        {/* 4 · PERTIMBANGAN */}
        {view === 3 && (
          <>
            <Section title="Pertimbangan oleh TPOA" hint="Setelah pemaparan, TPOA menetapkan keputusan: setuju atau tolak.">
              <div className="grid grid-cols-2 max-[700px]:grid-cols-1 gap-4">
                {([["setuju", "Setuju", "Lanjut ke surat rekomendasi"], ["tolak", "Tolak", "Proses berakhir pada tahap ini"]] as const).map(([k, t, s]) => (
                  <button key={k} disabled={final} onClick={() => setKeputusan(k)} className={`text-left p-5 rounded-xl border-2 cursor-pointer transition-colors disabled:cursor-not-allowed ${keputusan === k ? (k === "setuju" ? "border-forest bg-forest-soft" : "border-vermilion bg-vermilion-soft") : "border-slate-300/70 bg-white/60 hover:border-slate-400"}`}>
                    <div className="font-display text-2xl">{t}</div><div className="text-[13px] text-muted mt-1">{s}</div>
                  </button>
                ))}
              </div>
              {keputusan && <div className="mt-6"><Field label="Dasar pertimbangan" wide><textarea rows={3} className={field} value={alasan} disabled={final} onChange={(e) => setAlasan(e.target.value)} placeholder="Tuliskan dasar pertimbangan TPOA…" /></Field></div>}
            </Section>
            {rejected ? (
              <>
                <Banner tone="bad">Permohonan {org.name} ditolak. Proses pendaftaran berakhir pada tahap ini.</Banner>
                <MailStatus orgId={org.id} jenis="Pemberitahuan penolakan" />
                <div className="flex flex-wrap gap-3 items-center">
                  <Btn variant="ghost" disabled={notifSent} onClick={() => { setNotifSent(true); sendMail(ref, "Pemberitahuan penolakan", form.email || "email INGO", "Pertimbangan") }}>{notifSent ? "Pemberitahuan dibuat" : "Kirim pemberitahuan penolakan ke INGO"}</Btn>
                  {!notifSent && <Btn variant="ghost" onClick={() => setFinal(false)}>Batalkan penolakan</Btn>}
                </div>
              </>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <Btn variant={keputusan === "tolak" ? "danger" : "primary"} disabled={!keputusan || !alasan.trim() || final} onClick={() => confirm(keputusan === "tolak" ? "Tetapkan PENOLAKAN permohonan?" : "Tetapkan PERSETUJUAN permohonan?", <><div><strong>{keputusan === "tolak" ? "Tolak" : "Setuju"}</strong> · {org.name}</div><div className="mt-1">Dasar pertimbangan: {alasan}</div></>, keputusan === "tolak" ? "Ya, tetapkan penolakan" : "Ya, tetapkan persetujuan", () => { setFinal(true); addLog(ref, "Pertimbangan", `Keputusan TPOA: ${keputusan}. ${alasan}`); if (keputusan === "setuju") { addLog(ref, "Persetujuan", "Permohonan disetujui TPOA"); go(4) } })}>
                  {keputusan === "tolak" ? "Tetapkan penolakan" : "Tetapkan persetujuan"}
                </Btn>
                {keputusan && !alasan.trim() && <span className="text-[13px] text-muted">Dasar pertimbangan wajib diisi.</span>}
              </div>
            )}
          </>
        )}

        {/* 5 · SURAT REKOMENDASI */}
        {view === 4 && (
          <>
            <Section title="Surat Rekomendasi · Izin Prinsip Sementara" hint="Isi surat dibuat otomatis oleh sistem dari data pengajuan, verifikasi, rapat, dan pertimbangan. TPOA dapat menyesuaikannya, lalu mencetak atau mengirim lewat email.">
              <div className="grid grid-cols-2 max-[700px]:grid-cols-1 gap-x-6 gap-y-5">
                <Field label="K/L mitra tujuan"><select className={field} value={letter.kl} onChange={(e) => changeKl(e.target.value)}>{klList.map((k) => <option key={k}>{k}</option>)}</select></Field>
                <Field label="Email tujuan"><input className={field} value={letter.to} onChange={setL("to")} /></Field>
                <Field label="Tembusan (Cc)"><input className={field} value={ccValue} onChange={(e) => setLetter((l) => ({ ...l, cc: e.target.value }))} /></Field>
                <Field label="Nomor surat"><input className={field} value={letter.nomor} onChange={setL("nomor")} /></Field>
                <Field label="Perihal" wide><input className={field} value={letter.perihal} onChange={setL("perihal")} /></Field>
                <Field label="Isi surat (otomatis dari sistem)" wide>
                  <textarea rows={16} className={field} value={body} onChange={(e) => { setBodyEdited(true); setLetter((l) => ({ ...l, body: e.target.value })) }} />
                </Field>
              </div>
              <div className="flex flex-wrap gap-3 mt-3">
                <Btn variant="ghost" onClick={regen}>↻ Generate ulang dari sistem</Btn>
                <Btn variant="ghost" onClick={printLetter}>🖨 Cetak surat izin prinsip sementara</Btn>
              </div>

              <h4 className="font-display text-xl mt-8">Dokumen surat</h4>
              <div className="glass overflow-x-auto mt-3">
                <table className="w-full text-[14px] min-w-[560px]">
                  <thead>
                    <tr className="text-left font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted border-b border-slate-300/70">
                      <th className="p-3 w-10 font-normal">No</th><th className="p-3 font-normal">Nama berkas</th><th className="p-3 w-60 font-normal">Jenis</th><th className="p-3 w-24 font-normal">Ukuran</th><th className="p-3 w-32 font-normal">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-slate-200/80 bg-forest-soft/50">
                      <td className="p-3 font-mono text-muted">01</td>
                      <td className="p-3 font-medium">Surat-Izin-Prinsip-Sementara-{ipNo.replace(/\//g, "-")}.pdf <span className="ml-1 px-1.5 py-0.5 rounded bg-forest-soft font-mono text-[10px] text-forest-deep">dibuat sistem</span></td>
                      <td className="p-3">{fileKinds[0]}</td><td className="p-3 font-mono text-[12px]">otomatis</td>
                      <td className="p-3"><button className="text-primary text-[13px] font-semibold underline underline-offset-4 cursor-pointer" onClick={printLetter}>Cetak</button></td>
                    </tr>
                    {files.map((f, i) => (
                      <tr key={f.id} className="border-b border-slate-200/80 last:border-0">
                        <td className="p-3 font-mono text-muted">{String(i + 2).padStart(2, "0")}</td>
                        <td className="p-3 font-medium break-all">{f.file.name}</td>
                        <td className="p-3"><select className={cellInput} value={f.kind} onChange={(e) => setFiles(files.map((x) => (x.id === f.id ? { ...x, kind: e.target.value } : x)))}>{fileKinds.map((k) => <option key={k}>{k}</option>)}</select></td>
                        <td className="p-3 font-mono text-[12px]">{sizeLabel(f.file.size)}</td>
                        <td className="p-3"><button className="text-vermilion text-[13px] font-semibold underline underline-offset-4 cursor-pointer" onClick={() => setFiles(files.filter((x) => x.id !== f.id))}>Hapus</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div
                onDragOver={(e: DragEvent<HTMLDivElement>) => { e.preventDefault(); setOver(true) }}
                onDragLeave={() => setOver(false)}
                onDrop={(e: DragEvent<HTMLDivElement>) => { e.preventDefault(); setOver(false); addFiles(e.dataTransfer.files) }}
                onClick={() => inputRef.current?.click()}
                className={`mt-3 cursor-pointer rounded-xl border-2 border-dashed px-6 py-6 text-center transition-colors ${over ? "border-forest bg-forest-soft" : "border-slate-300 bg-white/50 hover:border-forest"}`}
              >
                <div className="text-[14px]">Tambah lampiran pendukung (opsional) · klik atau letakkan berkas</div>
              </div>
              <input ref={inputRef} type="file" multiple accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = "" }} />
            </Section>

            <MailStatus orgId={org.id} jenis="Surat rekomendasi" />
            {sent ? (
              <>
                <Banner tone="ok">Surat dikirim ke {letter.to} (tembusan: {ccValue || "—"}) dengan {files.length + 1} lampiran.</Banner>
                <Btn onClick={() => go(5)}>Lanjut ke penerbitan surat izin tetap</Btn>
              </>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <Btn disabled={!canSend} onClick={() => confirm("Kirim surat rekomendasi melalui email?", <><div>Kepada: {letter.to}</div><div>Cc: {ccValue}</div><div>Nomor: {letter.nomor}</div><div>Perihal: {letter.perihal}</div><pre className="whitespace-pre-wrap font-sans mt-2">{body}</pre></>, "Ya, kirim surat", () => { setSent(true); sendMail(ref, "Surat rekomendasi", letter.to, "Surat Rekomendasi") })}>Kirim surat melalui email</Btn>
                {!canSend && <span className="text-[13px] text-muted">Isi email tujuan.</span>}
              </div>
            )}
          </>
        )}

        {view === 5 && (
          <div className="glass p-10 max-w-2xl">
            <div className="font-mono text-[11px] tracking-[0.25em] uppercase text-forest-deep">Coming soon</div>
            <h3 className="font-display text-3xl mt-3 text-gradient">Penerbitan Surat Izin Tetap</h3>
            <p className="text-muted text-[14.5px] leading-relaxed mt-4">Tahap ini akan diaktifkan setelah seluruh alur sebelumnya dinyatakan sesuai oleh TPOA.</p>
            <div className="mt-6"><Btn disabled>Belum tersedia</Btn></div>
          </div>
        )}
      </div>
    </div>
  )
}

export const markPersonilOk = (orgId: string) => {
  writeLS(`p:${orgId}:personilOk`, true)
  writeLS(`p:${orgId}:reached`, Math.max(1, readLS<number>(`p:${orgId}:reached`, 0)))
  writeLS(`p:${orgId}:view`, 1)
  bump()
}
