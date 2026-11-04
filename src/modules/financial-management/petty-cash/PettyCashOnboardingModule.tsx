"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Choice, Fund, MasterLinks, Page } from "./onboarding-types";
import { useOnboardingRead } from "./hooks/useOnboarding";
import { OnboardingPayees } from "./components/OnboardingPayees";
import { OnboardingSettings } from "./components/OnboardingSettings";
import { ErrorBox, Paging } from "./components/OnboardingCommon";

export default function PettyCashOnboardingModule() {
  const links = useOnboardingRead<MasterLinks>("master-links");
  return <section className="space-y-5"><div><h1 className="text-2xl font-semibold tracking-tight">Onboarding</h1><p className="mt-2 text-sm text-muted-foreground">Configure the real master records and policy used by Petty Cash. Financial workflows become available in later increments.</p></div>
    <ErrorBox error={links.error} retry={links.refresh} />
    <Tabs defaultValue="funds"><TabsList className="h-auto w-full flex-wrap justify-start gap-1">
      <TabsTrigger value="funds">Funds</TabsTrigger><TabsTrigger value="payees">Payees</TabsTrigger><TabsTrigger value="departments">Departments</TabsTrigger><TabsTrigger value="personnel">Personnel</TabsTrigger><TabsTrigger value="settings">Company &amp; Policy Settings</TabsTrigger>
    </TabsList>
      <TabsContent value="funds"><Funds /></TabsContent><TabsContent value="payees"><OnboardingPayees links={links.data} /></TabsContent>
      <TabsContent value="departments"><SharedMaster resource="departments" links={links.data} /></TabsContent><TabsContent value="personnel"><SharedMaster resource="personnel" links={links.data} /></TabsContent>
      <TabsContent value="settings"><OnboardingSettings links={links.data} /></TabsContent>
    </Tabs>
  </section>;
}
function SharedMaster({ resource, links }: { resource: "departments" | "personnel"; links: MasterLinks | null }) {
  const [search, setSearch] = useState(""); const [page, setPage] = useState(1);
  const { data, loading, error, refresh } = useOnboardingRead<Page<Choice>>(`lookups/${resource}?${new URLSearchParams({ search, page: String(page), pageSize: "25" })}`, 250);
  const link = links?.[resource]; const title = resource === "departments" ? "Departments" : "Personnel";
  return <div className="space-y-4 rounded-xl border bg-card p-5"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">{title}</h2>{link?.allowed && link.path && <Button variant="outline" asChild><a href={link.path}>Manage {resource}</a></Button>}</div>
    <p className="text-sm text-muted-foreground">These are shared master records. Changes use the existing management screen and its permissions.</p>
    <Input aria-label={`Search ${resource}`} placeholder={`Search ${resource}`} value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} /><ErrorBox error={error} retry={refresh} />
    {loading && <p role="status">Loading {resource}...</p>}{data && <><div className="overflow-x-auto rounded-lg border"><table className="w-full text-left text-sm"><thead className="bg-muted/40"><tr><th className="p-3">Name</th><th className="p-3">{resource === "departments" ? "Division" : "Department"}</th><th className="p-3">Status</th></tr></thead><tbody>
      {data.items.map(item => <tr key={item.id} className="border-t"><td className="p-3">{item.name}</td><td className="p-3">{item.classification || "Not configured"}</td><td className="p-3">{item.status}</td></tr>)}{!data.items.length && <tr><td colSpan={3} className="p-6 text-center text-muted-foreground">No matching records.</td></tr>}
    </tbody></table></div><Paging page={page} total={data.total} pageSize={data.pageSize} onChange={setPage} /></>}
  </div>;
}
function Funds() {
  const [search, setSearch] = useState(""); const [page, setPage] = useState(1);
  const { data, loading, error, refresh } = useOnboardingRead<Page<Fund>>(`funds?${new URLSearchParams({ search, page: String(page), pageSize: "25" })}`, 250);
  const money = (value: number | null) => value === null ? "—" : new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(value);
  return <div className="space-y-4 rounded-xl border bg-card p-5"><h2 className="text-lg font-semibold">Fund requests</h2><p className="text-sm text-muted-foreground">Fund creation and submission are delivered in Increment 3. This register does not change cash or the ledger.</p>
    <Input aria-label="Search funds" placeholder="Search fund number or name" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} /><ErrorBox error={error} retry={refresh} />
    {loading && <p role="status">Loading funds...</p>}{data && <><div className="overflow-x-auto rounded-lg border"><table className="w-full text-left text-sm"><thead className="bg-muted/40"><tr>{["Fund", "Name", "Imprest", "Per voucher", "Approval above", "Status"].map(label => <th key={label} className="p-3">{label}</th>)}</tr></thead><tbody>
      {data.items.map(item => <tr className="border-t" key={item.id}><td className="p-3">{item.docNo}</td><td className="p-3">{item.name || "—"}</td><td className="p-3">{money(item.imprestAmount)}</td><td className="p-3">{money(item.perVoucherLimit)}</td><td className="p-3">{money(item.approvalThreshold)}</td><td className="p-3">{item.status}</td></tr>)}{!data.items.length && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No fund requests yet.</td></tr>}
    </tbody></table></div><Paging page={page} total={data.total} pageSize={data.pageSize} onChange={setPage} /></>}
  </div>;
}
