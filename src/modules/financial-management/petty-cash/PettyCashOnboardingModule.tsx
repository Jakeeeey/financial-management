"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Choice, MasterLinks, Page } from "./onboarding-types";
import { useOnboardingRead } from "./hooks/useOnboarding";
import { OnboardingPayees } from "./components/OnboardingPayees";
import { OnboardingSettings } from "./components/OnboardingSettings";
import { OnboardingFunds } from "./components/OnboardingFunds";
import { ErrorBox, Paging } from "./components/OnboardingCommon";

export default function PettyCashOnboardingModule({ requesterName, canSubmitFund }: { requesterName: string; canSubmitFund: boolean }) {
  const links = useOnboardingRead<MasterLinks>("master-links");
  return <section className="space-y-5"><div><h1 className="text-2xl font-semibold tracking-tight">Onboarding</h1><p className="mt-2 text-sm text-muted-foreground">Configure the real master records and policy used by Petty Cash. Financial workflows become available in later increments.</p></div>
    <ErrorBox error={links.error} retry={links.refresh} />
    <Tabs defaultValue="funds"><TabsList className="h-auto w-full flex-wrap justify-start gap-1">
      <TabsTrigger value="funds">Funds</TabsTrigger><TabsTrigger value="payees">Payees</TabsTrigger><TabsTrigger value="departments">Departments</TabsTrigger><TabsTrigger value="personnel">Personnel</TabsTrigger><TabsTrigger value="settings">Company &amp; Policy Settings</TabsTrigger>
    </TabsList>
      <TabsContent value="funds"><OnboardingFunds requesterName={requesterName} canSubmit={canSubmitFund} /></TabsContent><TabsContent value="payees"><OnboardingPayees links={links.data} /></TabsContent>
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
