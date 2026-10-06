import { useEffect, useState } from "react"
import { DashboardHome, InformationCenterPage, RegistrationYayasan, SettingsPage } from "./HomeDashboard"
import { ChairApprovalPage, MspExtensionPage, RegistrationIngoPage, type RegistrationStage } from "./RegistrationIngoPages"
import { LetterEditorPage, type LetterType } from "./LetterPages"
import { PlenaryPlannerPage } from "./WorkflowPages"
import { PersonnelPage } from "./PersonnelPage"
import { Clock, useLocal } from "./store"

// Simpan foto gedung Kemlu (Pejambon) di folder public/ dengan nama kemlu-pejambon.jpg.
// Selama file itu belum ada, foto cadangan di bawah yang dipakai.
const BG_LOCAL = "/kemlu-pejambon.jpg"
const BG_FALLBACK =
  "https://images.unsplash.com/photo-1591448654263-a243151f612f?w=2000&q=80&auto=format&fit=crop"

const menuGroups = [
  { code: "01", label: "Dashboard", path: "/", active: (route: string) => route === "/" || route === "/data-personil", links: [
    { path: "/data-personil", label: "Data Personil" },
  ] },
  { code: "02", label: "Pendaftaran", path: "/registrasi-ingo/permohonan", active: (route: string) => route.startsWith("/registrasi-"), links: [
    { path: "/registrasi-ingo/permohonan", label: "Reg. INGO" },
    { path: "/registrasi-yayasan", label: "Reg. Yayasan" },
    { path: "/registrasi-ingo/perpanjangan-msp", label: "Perpanjangan MSP" },
  ] },
  { code: "03", label: "Surat", path: "/surat/rekomendasi-kl", active: (route: string) => route.startsWith("/surat/"), links: [
    { path: "/surat/rekomendasi-kl", label: "Rekomendasi calon K/L mitra" },
    { path: "/surat/izin-prinsip-sementara", label: "Izin prinsip sementara" },
    { path: "/surat/rekomendasi-msp", label: "Rekomendasi penandatanganan MSP" },
    { path: "/surat/izin-prinsip-tetap", label: "Izin prinsip tetap" },
    { path: "/surat/perpanjangan-msp", label: "Perpanjangan MSP" },
  ] },
  { code: "04", label: "Rapat Pleno", path: "/rapat-pleno", active: (route: string) => route === "/rapat-pleno", links: [] },
]

const letterRoutes: Record<string, LetterType> = {
  "/surat/rekomendasi-kl": "rekomendasi-kl",
  "/surat/izin-prinsip-sementara": "izin-prinsip-sementara",
  "/surat/rekomendasi-msp": "rekomendasi-msp",
  "/surat/izin-prinsip-tetap": "izin-prinsip-tetap",
}

const knownRoutes = new Set([
  ...menuGroups.flatMap((group) => [group.path, ...group.links.map((item) => item.path)]),
  ...Object.keys(letterRoutes),
  "/registrasi-ingo",
  "/registrasi-ingo/verifikasi",
  "/registrasi-ingo/persetujuan-ketua",
  "/registrasi-ingo/pertimbangan",
  "/surat/perpanjangan-msp",
  "/rapat-pleno",
  "/pengaturan",
  "/pusat-informasi",
])

const currentRoute = () => window.location.hash.slice(1).split("?")[0] || "/"

export default function App() {
  const [route, setRoute] = useState(currentRoute)
  const [theme, setTheme] = useLocal<"light" | "dark">("tpoa:theme", "light")
  const [fontStyle, setFontStyle] = useLocal<"manrope" | "sora">("tpoa:font-style", "manrope")
  const [accentColor, setAccentColor] = useLocal<"teal" | "blue">("tpoa:accent-color", "teal")
  useEffect(() => {
    const syncRoute = () => setRoute(currentRoute())
    window.addEventListener("hashchange", syncRoute)
    return () => window.removeEventListener("hashchange", syncRoute)
  }, [])

  const routeClass = (active: boolean) => `text-left flex flex-1 items-baseline gap-3 px-3 py-3 border-l-2 rounded-r-lg transition-colors cursor-pointer whitespace-nowrap ${active ? "border-forest bg-forest-soft text-ink" : "border-transparent text-muted hover:text-ink hover:bg-white/60"}`

  return (
    <div className={`relative min-h-screen text-ink ${theme === "dark" ? "theme-dark" : ""} ${fontStyle === "sora" ? "font-sora" : ""} ${accentColor === "blue" ? "accent-blue" : ""}`}>
      <div
        aria-hidden
        className="fixed inset-0 -z-10 bg-paper bg-cover bg-center"
        style={{ backgroundImage: `url(${BG_LOCAL}), url(${BG_FALLBACK})` }}
      />
      <div aria-hidden className="fixed inset-0 -z-10 kemlu-overlay" />
      <div aria-hidden className="fixed inset-0 -z-10 hud-grid" />

      <div className="grid grid-cols-[256px_minmax(0,1fr)] max-[1000px]:grid-cols-1 min-h-screen">
        <aside className="flex flex-col gap-10 overflow-y-auto p-7 border-r border-white/70 bg-white/55 backdrop-blur-xl min-[1001px]:sticky min-[1001px]:top-0 min-[1001px]:h-screen max-[1000px]:p-5 max-[1000px]:gap-5 max-[1000px]:border-r-0 max-[1000px]:border-b">
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

          <nav className="flex flex-col gap-1 max-[1000px]:flex-row max-[1000px]:flex-wrap max-[1000px]:overflow-visible">
            {menuGroups.map((group) => (
              <div key={group.path} className="group relative flex flex-wrap items-center gap-1">
                <a href={`#${group.path}`} className={routeClass(group.active(route))}>
                  <span className="font-mono text-[11px] opacity-70">{group.code}</span>
                  <span className="text-[14.5px] font-semibold">{group.label}</span>
                </a>
                {group.links.length > 0 && <>
                  <span aria-hidden="true" className="px-2 text-lg leading-none text-muted transition-colors group-hover:text-forest-deep">⋮</span>
                  <div className="hidden basis-full rounded-lg border border-white/80 bg-white/90 p-2 shadow-inner backdrop-blur-xl group-hover:block group-focus-within:block">
                    <div className="px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted">{group.label}</div>
                    {group.links.map((item) => <a key={item.path} href={`#${item.path}`} className={`block rounded-md px-3 py-2 text-[13px] transition-colors hover:bg-forest-soft hover:text-ink ${route === item.path ? "bg-forest-soft text-ink" : "text-muted"}`}>{item.label}</a>)}
                  </div>
                </>}
              </div>
            ))}
          </nav>

          <Clock />

          <div className="flex gap-2" aria-label="Pengaturan dan informasi">
            <a href="#/pengaturan" aria-label="Pengaturan tampilan" title="Pengaturan tampilan" className={`flex min-w-0 flex-1 items-center justify-center gap-2 rounded-md border px-2 py-2.5 transition-colors ${route === "/pengaturan" ? "border-forest bg-forest-soft text-forest-deep" : "border-slate-300/70 bg-white/45 text-muted hover:bg-white/75 hover:text-ink"}`}>
              <span aria-hidden="true" className="text-xl leading-none">⚙</span><span className="text-[12px] font-semibold">Pengaturan</span>
            </a>
            <a href="#/pusat-informasi" aria-label="Pusat informasi" title="Pusat informasi" className={`flex min-w-0 flex-1 items-center justify-center gap-2 rounded-md border px-2 py-2.5 transition-colors ${route === "/pusat-informasi" ? "border-forest bg-forest-soft text-forest-deep" : "border-slate-300/70 bg-white/45 text-muted hover:bg-white/75 hover:text-ink"}`}>
              <span aria-hidden="true" className="text-xl leading-none">ⓘ</span><span className="text-[12px] font-semibold">Informasi</span>
            </a>
          </div>

          <div className="mt-auto text-[12px] text-muted leading-relaxed max-[1000px]:hidden">
            <div className="font-mono uppercase tracking-widest text-[10px] mb-1">Masuk sebagai</div>
            <div className="text-ink text-[14px]">Sekretariat TPOA</div>
            <div>Hanya untuk staf dan petugas TPOA, bukan untuk publik.</div>
            <div className="mt-1">Prototype · data dummy</div>
          </div>
        </aside>

        <main className="min-w-0 px-10 py-9 max-[1000px]:px-4 max-[1000px]:py-5">
          {route === "/" && <DashboardHome />}
          {route === "/data-personil" && <PersonnelPage />}
          {route === "/pengaturan" && <SettingsPage theme={theme} onThemeChange={setTheme} fontStyle={fontStyle} onFontStyleChange={setFontStyle} accentColor={accentColor} onAccentColorChange={setAccentColor} />}
          {route === "/pusat-informasi" && <InformationCenterPage />}
          {(route === "/registrasi-ingo" || route === "/registrasi-ingo/permohonan") && <RegistrationIngoPage stage={"permohonan" satisfies RegistrationStage} />}
          {route === "/registrasi-ingo/verifikasi" && <RegistrationIngoPage stage="verifikasi" />}
          {route === "/registrasi-ingo/persetujuan-ketua" && <ChairApprovalPage />}
          {route === "/registrasi-ingo/pertimbangan" && <RegistrationIngoPage stage="pertimbangan" />}
          {route === "/registrasi-ingo/perpanjangan-msp" && <MspExtensionPage />}
          {route === "/registrasi-yayasan" && <RegistrationYayasan />}
          {letterRoutes[route] && <LetterEditorPage letterType={letterRoutes[route]} />}
          {route === "/surat/perpanjangan-msp" && <MspExtensionPage />}
                    {route === "/rapat-pleno" && <PlenaryPlannerPage />}
          {!knownRoutes.has(route) && <DashboardHome />}
        </main>
      </div>
    </div>
  )
}