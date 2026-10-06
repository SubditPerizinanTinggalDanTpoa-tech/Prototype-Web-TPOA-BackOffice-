import { useLocal } from "./store"
import { Field, type Org, type Person } from "./Ingo"
import { initialOrgs, initialPersonnel } from "./IngoDashboard"
import { Personil } from "./Personil"

export function PersonnelPage() {
  const [orgId, setOrgId] = useLocal("tpoa:active-ingo", initialOrgs[0].id)
  const [personnel, setPersonnel] = useLocal<Record<string, Person[]>>("tpoa:personil", initialPersonnel)
  const org: Org = initialOrgs.find((item) => item.id === orgId) ?? initialOrgs[0]
  return <div>
    <header className="mb-8 border-b border-slate-300/70 pb-7">
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-forest-deep">Dashboard · Data INGO</div>
      <h1 className="mt-3 font-display text-[36px] leading-tight text-ink max-[700px]:text-[29px]">Data Personil</h1>
      <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-muted">Data personil INGO dikelola dan divalidasi terpisah dari verifikasi dokumen registrasi.</p>
      <div className="mt-5 max-w-md"><Field label="Pilih INGO"><select className="w-full rounded-lg border border-slate-300/70 bg-white/70 px-3 py-2.5 text-[14px]" value={org.id} onChange={(event) => setOrgId(event.target.value)}>{initialOrgs.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field></div>
    </header>
    <div className="glass p-6 max-[700px]:p-4">
      <Personil
        org={org}
        rows={personnel[org.id] ?? []}
        source={initialPersonnel[org.id] ?? []}
        onChange={(rows) => setPersonnel((current) => ({ ...current, [org.id]: rows }))}
        onVerified={() => {}}
        showWorkflowValidation={false}
      />
    </div>
    <div className="mt-6"><a href="#/" className="rounded-md border border-primary/35 bg-white/50 px-5 py-2.5 text-[14px] font-semibold text-primary">Kembali ke menu utama</a></div>
  </div>
}