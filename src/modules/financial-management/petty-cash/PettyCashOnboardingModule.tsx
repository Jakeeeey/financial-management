"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { MasterLinks } from "./onboarding-types";
import { useOnboardingRead } from "./hooks/useOnboarding";
import { OnboardingPayees } from "./components/OnboardingPayees";
import { OnboardingFunds } from "./components/OnboardingFunds";
import { OnboardingTaxAccounts } from "./components/OnboardingTaxAccounts";
import { OnboardingAlerts } from "./components/OnboardingAlerts";
import { CompanySettingsDialog } from "./components/CompanySettingsDialog";
import { ErrorBox } from "./components/OnboardingCommon";

export default function PettyCashOnboardingModule({ requesterName, canSubmitFund, canEditFunds, canDeleteFunds, canEditSettings }: { requesterName: string; canSubmitFund: boolean; canEditFunds: boolean; canDeleteFunds: boolean; canEditSettings: boolean }) {
  const links = useOnboardingRead<MasterLinks>("master-links");
  const [taxAccountsOpen, setTaxAccountsOpen] = useState(false), [alertsOpen, setAlertsOpen] = useState(false), [companyOpen, setCompanyOpen] = useState(false), [settingsRevision, setSettingsRevision] = useState(0);
  return <section className="space-y-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-2xl font-semibold tracking-tight">Onboarding</h1><p className="mt-2 text-sm text-muted-foreground">Request new funds and maintain registered payees. A new fund stays inactive until it is approved.</p></div>{canEditSettings && <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => setCompanyOpen(true)}>Company details</Button><Button variant="outline" onClick={() => setAlertsOpen(true)}>Configure alerts</Button><Button variant="outline" onClick={() => setTaxAccountsOpen(true)}>Configure posting accounts</Button></div>}</div>
    <ErrorBox error={links.error} retry={links.refresh} title="Could not load onboarding links" />
    <Tabs defaultValue="funds"><TabsList className="h-auto w-fit max-w-full flex-wrap justify-start gap-1">
      <TabsTrigger value="funds">Fund requests</TabsTrigger><TabsTrigger value="payees">Payees</TabsTrigger>
    </TabsList>
      <TabsContent value="funds"><OnboardingFunds key={settingsRevision} requesterName={requesterName} canSubmit={canSubmitFund} canEdit={canEditFunds} canDelete={canDeleteFunds} /></TabsContent><TabsContent value="payees"><OnboardingPayees links={links.data} /></TabsContent>
    </Tabs>
    {canEditSettings && taxAccountsOpen && <OnboardingTaxAccounts onClose={() => setTaxAccountsOpen(false)} onSaved={() => { setTaxAccountsOpen(false); setSettingsRevision(value => value + 1); }} />}
    {canEditSettings && alertsOpen && <OnboardingAlerts onClose={() => setAlertsOpen(false)} onSaved={() => { setAlertsOpen(false); setSettingsRevision(value => value + 1); }} />}
    {canEditSettings && companyOpen && <CompanySettingsDialog onClose={() => setCompanyOpen(false)} />}
  </section>;
}
