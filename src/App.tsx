import { useState } from "react"
import IngoDashboard from "./IngoDashboard"
import { Clock } from "./store"

// Simpan foto gedung Kemlu (Pejambon) di folder public/ dengan nama kemlu-pejambon.jpg.
// Selama file itu belum ada, foto cadangan di bawah yang dipakai.
const BG_LOCAL = "/kemlu-pejambon.jpg"
const BG_FALLBACK =
  "https://images.unsplash.com/photo-1591448654263-a243151f612f?w=2000&q=80&auto=format&fit=crop"

const menu = [
  { id: "ingo", label: "Data INGO", code: "01" },
  { id: "yayasan", label: "Data Yayasan", code: "02" },
  { id: "ia", label: "Data IA", sub: "Implementing Agency", code: "03" },
] as const

export default function App() {
  const [active, setActive] = useState<string>("ingo")

  return (
    <div className="relative min-h-screen text-ink">
      <div
        aria-hidden
        className="fixed inset-0 -z-10 bg-paper bg-cover bg-center"
        style={{ backgroundImage: `url(${BG_LOCAL}), url(${BG_FALLBACK})` }}
      />
      <div aria-hidden className="fixed inset-0 -z-10 kemlu-overlay" />
      <div aria-hidden className="fixed inset-0 -z-10 hud-grid" />

      <div className="grid grid-cols-[256px_minmax(0,1fr)] max-[1000px]:grid-cols-1 min-h-screen">
        <aside className="flex flex-col gap-10 p-7 border-r border-white/70 bg-white/55 backdrop-blur-xl min-[1001px]:sticky min-[1001px]:top-0 min-[1001px]:h-screen max-[1000px]:p-5 max-[1000px]:gap-5 max-[1000px]:border-r-0 max-[1000px]:border-b">
          <div>
            <div className="flex items-center gap-2 font-mono text-[10.5px] tracking-[0.2em] uppercase text-forest-deep">
              <span className="w-1.5 h-1.5 rounded-full bg-forest shadow-[0_0_8px_var(--color-forest)]" />
              Kemlu · TPOA
            </div>
            <div className="font-display text-[22px] leading-[1.15] mt-3 text-ink">
              Portal Kemitraan
              <br />
              Organisasi Asing
            </div>
            <div className="inline-block mt-4 px-2.5 py-1 rounded-full border border-primary/25 bg-primary-light/60 font-mono text-[10px] tracking-[0.16em] uppercase text-primary">
              Internal TPOA
            </div>
          </div>

          <nav className="flex flex-col gap-1 max-[1000px]:flex-row max-[1000px]:overflow-x-auto">
            {menu.map((m) => (
              <button
                key={m.id}
                onClick={() => setActive(m.id)}
                className={`text-left flex items-baseline gap-3 px-3 py-3 border-l-2 rounded-r-lg transition-colors cursor-pointer whitespace-nowrap ${
                  active === m.id
                    ? "border-forest bg-forest-soft text-ink"
                    : "border-transparent text-muted hover:text-ink hover:bg-white/60"
                }`}
              >
                <span className="font-mono text-[11px] opacity-70">{m.code}</span>
                <span>
                  <span className="block text-[14.5px] font-semibold">{m.label}</span>
                  {"sub" in m && <span className="block text-[11px] opacity-70">{m.sub}</span>}
                </span>
              </button>
            ))}
          </nav>

          <Clock />

          <div className="mt-auto text-[12px] text-muted leading-relaxed max-[1000px]:hidden">
            <div className="font-mono uppercase tracking-widest text-[10px] mb-1">Masuk sebagai</div>
            <div className="text-ink text-[14px]">Sekretariat TPOA</div>
            <div>Hanya untuk staf dan petugas TPOA, bukan untuk publik.</div>
            <div className="mt-1">Prototype · data dummy</div>
          </div>
        </aside>

        <main className="min-w-0 px-10 py-9 max-[1000px]:px-4 max-[1000px]:py-5">
          {active === "ingo" ? (
            <IngoDashboard />
          ) : (
            <div className="pt-6">
              <div className="font-mono text-[11px] tracking-[0.2em] uppercase text-forest-deep">
                Segera hadir
              </div>
              <h1 className="font-display text-5xl mt-3 text-ink">
                {active === "yayasan" ? "Data Yayasan" : "Data IA"}
              </h1>
              <p className="text-muted mt-4 max-w-md">
                Halaman ini dirancang pada tahap berikutnya. Prototype tahap pertama berfokus pada
                Data INGO.
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}