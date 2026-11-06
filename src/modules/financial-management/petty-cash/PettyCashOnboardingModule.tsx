"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Choice, MasterLinks, Page } from "./onboarding-types";
import { useOnboardingRead } from "./hooks/useOnboarding";
import { OnboardingPayees } from "./components/OnboardingPayees";
import { OnboardingSettings } from "./components/OnboardingSettings";
import { OnboardingFunds } from "./components/OnboardingFunds";
import { OnboardingTaxAccounts } from "./components/OnboardingTaxAccounts";
import { OnboardingAlerts } from "./components/OnboardingAlerts";
import { ErrorBox, Paging } from "./components/OnboardingCommon";
import { TableSkeleton } from "./components/PettyCashSkeletons";

export default function PettyCashOnboardingModule({ requesterName, canSubmitFund, canEditFunds, canDeleteFunds, canEditSettings }: { requesterName: string; canSubmitFund: boolean; canEditFunds: boolean; canDeleteFunds: boolean; canEditSettings: boolean }) {
  const links = useOnboardingRead<MasterLinks>("master-links");
  const [taxAccountsOpen, setTaxAccountsOpen] = useState(false), [alertsOpen, setAlertsOpen] = useState(false), [settingsRevision, setSettingsRevision] = useState(0);
  return <section className="space-y-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-2xl font-semibold tracking-tight">Onboarding</h1><p className="mt-2 text-sm text-muted-foreground">Request new funds and maintain the lists used by Petty Cash. A new fund stays inactive until it is approved.</p></div>{canEditSettings && <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => setAlertsOpen(true)}>Configure alerts</Button><Button variant="outline" onClick={() => setTaxAccountsOpen(true)}>Configure posting accounts</Button></div>}</div>
    <ErrorBox error={links.error} retry={links.refresh} title="Could not load onboarding links" />
    <Tabs defaultValue="funds"><TabsList className="h-auto w-fit max-w-full flex-wrap justify-start gap-1">
      <TabsTrigger value="funds">Fund requests</TabsTrigger><TabsTrigger value="payees">Payees</TabsTrigger><TabsTrigger value="departments">Departments</TabsTrigger><TabsTrigger value="personnel">Personnel</TabsTrigger><TabsTrigger value="settings">Company</TabsTrigger>
    </TabsList>
      <TabsContent value="funds"><OnboardingFunds key={settingsRevision} requesterName={requesterName} canSubmit={canSubmitFund} canEdit={canEditFunds} canDelete={canDeleteFunds} /></TabsContent><TabsContent value="payees"><OnboardingPayees links={links.data} /></TabsContent>
      <TabsContent value="departments"><SharedMaster resource="departments" /></TabsContent><TabsContent value="personnel"><SharedMaster resource="personnel" /></TabsContent>
      <TabsContent value="settings"><OnboardingSettings key={settingsRevision} /></TabsContent>
    </Tabs>
    {canEditSettings && taxAccountsOpen && <OnboardingTaxAccounts onClose={() => setTaxAccountsOpen(false)} onSaved={() => { setTaxAccountsOpen(false); setSettingsRevision(value => value + 1); }} />}
    {canEditSettings && alertsOpen && <OnboardingAlerts onClose={() => setAlertsOpen(false)} onSaved={() => { setAlertsOpen(false); setSettingsRevision(value => value + 1); }} />}
  </section>;
}
function SharedMaster({ resource }: { resource: "departments" | "personnel" }) {
  const [page, setPage] = useState(1);
  const { data, loading, error, refresh } = useOnboardingRead<Page<Choice>>(`lookups/${resource}?page=${page}&pageSize=25`);
  const title = resource === "departments" ? "Departments" : "Personnel";
  return <div className="space-y-4 rounded-xl border bg-card p-5"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">{title}</h2></div>
    <ErrorBox error={error} retry={refresh} title={`Could not load ${resource}`} />
    {loading && <TableSkeleton label={`Loading ${resource}`} rows={5} columns={3} />}{data && <><div className="overflow-x-auto rounded-lg border"><table className="w-full text-left text-sm"><thead className="bg-muted/40"><tr>{(resource === "departments" ? ["Department", "Funds", "Personnel"] : ["Name", "Department", "Active funds held"]).map(label => <th key={label} className="p-3">{label}</th>)}</tr></thead><tbody>
      {data.items.map(item => <tr className="border-t" key={item.id}><td className="p-3">{item.name}</td><td className="p-3">{resource === "departments" ? Number(item.details.funds || 0) : item.classification || "—"}</td><td className="p-3">{Number(item.details[resource === "departments" ? "personnel" : "activeFunds"] || 0)}</td></tr>)}{!data.items.length && <tr><td colSpan={3} className="p-6 text-center text-muted-foreground">No matching records.</td></tr>}
    </tbody></table></div>{data.total > data.pageSize && <Paging page={page} total={data.total} pageSize={data.pageSize} onChange={setPage} />}</>}
  </div>;
}
