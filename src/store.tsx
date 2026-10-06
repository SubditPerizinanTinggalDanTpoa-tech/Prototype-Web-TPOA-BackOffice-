import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react"

/* ───────── waktu ───────── */
export const stamp = (d: Date | string | number = new Date()) => {
  const x = new Date(d)
  return {
    tgl: x.toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" }),
    jam: x.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).replace(/\./g, ":"),
    tahun: x.getFullYear(),
  }
}
export const stampStr = (d: Date | string | number) => {
  const s = stamp(d)
  return `${s.tgl} · ${s.jam}`
}

export function Clock() {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  const s = stamp(now)
  const hari = now.toLocaleDateString("id-ID", { weekday: "long" })
  return (
    <div className="glass px-3 py-2.5">
      <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">Waktu aktif · WIB</div>
      <div className="font-display text-[22px] leading-none mt-1 tabular-nums">{s.jam}</div>
      <div className="text-[12px] text-muted mt-1">
        {hari}, {s.tgl}
      </div>
      <div className="font-mono text-[11px] text-forest-deep">Tahun {s.tahun}</div>
    </div>
  )
}

/* ───────── penyimpanan ───────── */
export function readLS<T>(key: string, init: T): T {
  try {
    const v = localStorage.getItem(key)
    return v === null ? init : (JSON.parse(v) as T)
  } catch {
    return init
  }
}
export function writeLS(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v))
  } catch {
    /* penyimpanan penuh / dinonaktifkan */
  }
}

export type StoredLocalFile = { name: string; type: string; size: number; blob: Blob; updatedAt: number }

function openFileDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("tpoa-device-files", 1)
    request.onupgradeneeded = () => request.result.createObjectStore("files")
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function saveDeviceFile(key: string, file: File) {
  const database = await openFileDatabase()
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction("files", "readwrite")
    transaction.objectStore("files").put({ name: file.name, type: file.type, size: file.size, blob: file, updatedAt: Date.now() }, key)
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
  })
  database.close()
}

export async function readDeviceFile(key: string): Promise<StoredLocalFile | null> {
  const database = await openFileDatabase()
  const stored = await new Promise<StoredLocalFile | undefined>((resolve, reject) => {
    const request = database.transaction("files", "readonly").objectStore("files").get(key)
    request.onsuccess = () => resolve(request.result as StoredLocalFile | undefined)
    request.onerror = () => reject(request.error)
  })
  database.close()
  return stored ?? null
}

export async function downloadDeviceFile(file: StoredLocalFile) {
  const url = URL.createObjectURL(file.blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = file.name
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 60000)
}

let ver = 0
const listeners = new Set<() => void>()
export const bump = () => {
  ver++
  listeners.forEach((l) => l())
}
export const useVersion = () =>
  useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => ver,
  )

// State yang otomatis tersimpan; tidak berubah kecuali pengguna mengubahnya.
export function useLocal<T>(key: string, init: T) {
  const [v, setV] = useState<T>(() => readLS(key, init))
  useEffect(() => {
    writeLS(key, v)
  }, [key, v])
  return [v, setV] as const
}

/* ───────── log monitoring ───────── */
export const CATS = ["Data", "Verifikasi", "Persetujuan", "Rapat", "Pertimbangan", "Surat Rekomendasi"] as const
export type Cat = (typeof CATS)[number]
export type Log = { id: number; t: number; org: string; orgName: string; cat: Cat; aksi: string }
export type OrgRef = { id: string; name: string }

export function addLog(org: OrgRef, cat: Cat, aksi: string) {
  const l = readLS<Log[]>("tpoa:log", [])
  l.unshift({ id: Date.now() + Math.random(), t: Date.now(), org: org.id, orgName: org.name, cat, aksi })
  writeLS("tpoa:log", l.slice(0, 500))
  bump()
}
export const getLog = () => readLS<Log[]>("tpoa:log", [])

/* ───────── kotak keluar email (dengan kirim ulang) ───────── */
export type Mail = { id: number; t: number; org: string; orgName: string; jenis: string; to: string; status: "Terkirim" | "Gagal"; tries: number }

// Simulasi: sebagian pengiriman gagal (atau offline) agar fitur kirim ulang dapat dicoba.
const attempt = () => navigator.onLine && Math.random() > 0.25
export function sendMail(org: OrgRef, jenis: string, to: string, cat: Cat = "Data") {
  const ms = readLS<Mail[]>("tpoa:mail", [])
  const m: Mail = { id: Date.now(), t: Date.now(), org: org.id, orgName: org.name, jenis, to, status: attempt() ? "Terkirim" : "Gagal", tries: 1 }
  writeLS("tpoa:mail", [m, ...ms].slice(0, 200))
  addLog(org, cat, `Email "${jenis}" ke ${to}: ${m.status}`)
  return m
}
export function resendMail(id: number) {
  const ms = readLS<Mail[]>("tpoa:mail", [])
  const m = ms.find((x) => x.id === id)
  if (!m) return
  m.tries++
  m.t = Date.now()
  m.status = attempt() ? "Terkirim" : "Gagal"
  writeLS("tpoa:mail", ms)
  addLog({ id: m.org, name: m.orgName }, "Data", `Kirim ulang email "${m.jenis}" (percobaan ${m.tries}): ${m.status}`)
}
export const getMails = () => readLS<Mail[]>("tpoa:mail", [])

export function MailStatus({ orgId, jenis }: { orgId: string; jenis: string }) {
  useVersion()
  const m = getMails().find((x) => x.org === orgId && x.jenis === jenis)
  if (!m) return null
  const bad = m.status === "Gagal"
  return (
    <div
      className={`border-l-4 rounded-r-lg px-5 py-3 text-[14px] mb-5 flex flex-wrap items-center gap-3 ${
        bad ? "bg-vermilion-soft border-vermilion" : "bg-forest-soft border-forest"
      }`}
    >
      <span>
        <strong>{bad ? "Email tidak terkirim" : "Email terkirim"}</strong> ke {m.to} · {stampStr(m.t)} · percobaan {m.tries}
      </span>
      {bad && (
        <button
          onClick={() => resendMail(m.id)}
          className="ml-auto px-4 py-1.5 rounded-lg bg-vermilion text-white text-[13px] font-medium cursor-pointer hover:brightness-110"
        >
          Kirim ulang
        </button>
      )}
    </div>
  )
}

/* ───────── konfirmasi dua tahap ───────── */
type Ask = { title: string; detail: ReactNode; ok: string; fn: () => void } | null

export function useConfirm() {
  const [ask, setAsk] = useState<Ask>(null)
  const [step, setStep] = useState(1)
  const close = () => {
    setAsk(null)
    setStep(1)
  }
  const node = ask && (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4 no-print" role="dialog" aria-modal>
      <div className="glass bg-white! max-w-md w-full p-6">
        {step === 1 ? (
          <>
            <div className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted">Konfirmasi · 1 dari 2</div>
            <h4 className="font-display text-2xl mt-2">Apakah Anda yakin?</h4>
            <p className="text-[14px] text-muted mt-2">{ask.title}</p>
            <div className="flex gap-3 mt-6">
              <button onClick={close} className="px-5 py-2.5 rounded-lg border border-slate-300 text-[14px] cursor-pointer hover:bg-slate-50">
                Tidak, lanjutkan mengisi
              </button>
              <button onClick={() => setStep(2)} className="px-5 py-2.5 rounded-lg bg-primary text-white text-[14px] cursor-pointer hover:brightness-110">
                Ya
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-ochre">Konfirmasi · 2 dari 2</div>
            <h4 className="font-display text-2xl mt-2">Periksa kembali isinya</h4>
            <p className="text-[14px] text-muted mt-2">Pastikan seluruh isi sudah sesuai sebelum dilanjutkan.</p>
            <div className="mt-3 rounded-lg border border-slate-300/70 bg-slate-50 p-3 text-[13.5px] leading-relaxed max-h-52 overflow-y-auto">{ask.detail}</div>
            <div className="flex gap-3 mt-6">
              <button onClick={close} className="px-5 py-2.5 rounded-lg border border-slate-300 text-[14px] cursor-pointer hover:bg-slate-50">
                Kembali, periksa lagi
              </button>
              <button
                onClick={() => {
                  ask.fn()
                  close()
                }}
                className="px-5 py-2.5 rounded-lg bg-linear-to-r from-primary to-forest text-white text-[14px] cursor-pointer hover:brightness-110"
              >
                {ask.ok}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
  return { node, confirm: (title: string, detail: ReactNode, ok: string, fn: () => void) => setAsk({ title, detail, ok, fn }) }
}

/* ───────── pratinjau lampiran ───────── */
export type DocRef = { n: string; f: string; syarat: string }

const docHtml = (d: DocRef, org: string) =>
  `<!doctype html><meta charset="utf-8"><title>${d.f}</title><body style="font-family:Georgia,serif;max-width:720px;margin:40px auto;padding:0 24px;line-height:1.6"><p style="font:12px monospace;color:#666">${d.f} · lampiran email dari ${org}</p><h2>${d.n}</h2><p><em>Pratinjau prototype: pada sistem sesungguhnya berkas asli lampiran email INGO tampil di sini.</em></p><p>${d.syarat}</p><hr><p>[Isi dokumen ${d.n} — ${org}]</p></body>`

export const openDocTab = (d: DocRef, org: string) => {
  const url = URL.createObjectURL(new Blob([docHtml(d, org)], { type: "text/html" }))
  window.open(url, "_blank")
}

export function DocModal({ doc, org, onClose }: { doc: DocRef | null; org: string; onClose: () => void }) {
  if (!doc) return null
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4" onClick={onClose}>
      <div className="glass bg-white! max-w-2xl w-full p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-mono text-[11.5px] text-forest-deep">{doc.f}</div>
            <h4 className="font-display text-2xl mt-1">{doc.n}</h4>
          </div>
          <button onClick={onClose} className="text-muted text-xl cursor-pointer" aria-label="Tutup">
            ✕
          </button>
        </div>
        <div className="mt-4 h-64 rounded-lg border border-slate-300/70 bg-slate-50 p-5 overflow-y-auto text-[13.5px] leading-relaxed">
          <p className="font-mono text-[11px] text-muted">Lampiran email dari {org}</p>
          <p className="mt-3 font-semibold">{doc.n}</p>
          <p className="mt-2 text-muted">Pratinjau prototype. Pada sistem sesungguhnya berkas asli dari INGO tampil di sini.</p>
          <p className="mt-4">
            <strong>Ketentuan yang diperiksa TPOA:</strong> {doc.syarat}
          </p>
        </div>
        <div className="flex gap-3 mt-4">
          <button onClick={() => openDocTab(doc, org)} className="px-5 py-2.5 rounded-lg bg-primary text-white text-[14px] cursor-pointer hover:brightness-110">
            Buka di tab baru
          </button>
          <button onClick={onClose} className="px-5 py-2.5 rounded-lg border border-slate-300 text-[14px] cursor-pointer hover:bg-slate-50">
            Tutup
          </button>
        </div>
      </div>
    </div>
  )
}

export function SaveBar({ dirty, savedAt, onSave }: { dirty: boolean; savedAt: number | null; onSave?: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-3 text-[13px]">
      <span className={`px-2 py-0.5 rounded-full font-mono text-[11px] ${dirty ? "bg-ochre-soft text-amber-700" : "bg-forest-soft text-forest-deep"}`}>
        {dirty ? "Perubahan belum disimpan" : "Progres tersimpan"}
      </span>
      {savedAt && <span className="text-muted">Terakhir disimpan {stampStr(savedAt)}</span>}
      {dirty && onSave && (
        <button onClick={onSave} className="text-forest-deep font-semibold underline underline-offset-4 cursor-pointer">
          Simpan sekarang
        </button>
      )}
    </div>
  )
}
