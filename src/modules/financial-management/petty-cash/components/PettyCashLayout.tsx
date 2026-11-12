"use client";

import { createContext, Suspense, useContext, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { PageSkeleton } from "./PettyCashSkeletons";
import { NavUser } from "@/components/shared/app-sidebar/nav-user";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { PETTY_CASH_ROOT, PETTY_CASH_WORKSPACES, isPettyCashWorkspace, type PettyCashContext, type PettyCashWorkspaceKey } from "../types";
import { loadPettyCashContext, PettyCashApiError } from "../providers/foundation.api";
import { loginUrl } from "../utils/sessionExpiry";
import PettyCashOnboardingModule from "../PettyCashOnboardingModule";
import PettyCashDisbursementModule from "../PettyCashDisbursementModule";
import PettyCashFundsModule from "../PettyCashFundsModule";
import PettyCashOnboardingApprovalModule from "../PettyCashOnboardingApprovalModule";
import PettyCashReplenishmentApprovalModule from "../PettyCashReplenishmentApprovalModule";
import PettyCashReplenishmentModule from "../PettyCashReplenishmentModule";
import PettyCashCashCountModule from "../PettyCashCashCountModule";
import PettyCashReportsModule from "../PettyCashReportsModule";
import type { PettyCashHeaderUser } from "../utils/headerUser";

const Context = createContext<PettyCashContext | null>(null);

export function PettyCashLayout({ children, headerUser }: { children: ReactNode; headerUser: PettyCashHeaderUser }) {
  const pathname = usePathname();
  return <PettyCashPageAccess key={pathname} headerUser={headerUser}>{children}</PettyCashPageAccess>;
}

function PettyCashPageAccess({ children, headerUser }: { children: ReactNode; headerUser: PettyCashHeaderUser }) {
  const pathname = usePathname(); const router = useRouter();
  const [context, setContext] = useState<PettyCashContext | null>(null);
  const [error, setError] = useState<PettyCashApiError | null>(null);
  const [loading, setLoading] = useState(true); const [retry, setRetry] = useState(0);
  const key = pathname.slice(PETTY_CASH_ROOT.length + 1);
  const title = isPettyCashWorkspace(key) ? PETTY_CASH_WORKSPACES[key].title : "Petty Cash";
  useEffect(() => {
    const controller = new AbortController();
    loadPettyCashContext(controller.signal).then(data => { if (!controller.signal.aborted) setContext(data); })
      .catch(cause => {
        if (controller.signal.aborted) return;
        if (cause instanceof PettyCashApiError && cause.status === 401) { router.replace(loginUrl()); return; }
        setError(cause instanceof PettyCashApiError ? cause : new PettyCashApiError("Petty Cash is temporarily unavailable. Please retry.", 503));
      }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [retry, router]);
  return <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-background">
    <header className="relative z-10 flex h-14 min-w-0 shrink-0 items-center justify-between overflow-hidden border-b bg-background shadow-sm sm:h-16">
      <div className="flex h-full min-w-0 flex-1 items-center gap-2 overflow-hidden px-3 sm:px-4"><SidebarTrigger className="-ml-1 shrink-0" /><Separator orientation="vertical" className="mr-2 hidden shrink-0 data-[orientation=vertical]:h-4 sm:block" /><Breadcrumb className="min-w-0"><BreadcrumbList className="flex-nowrap overflow-hidden whitespace-nowrap">
        <BreadcrumbItem className="hidden shrink-0 md:inline-flex"><BreadcrumbLink asChild><Link href="/fm">FM</Link></BreadcrumbLink></BreadcrumbItem><BreadcrumbSeparator className="hidden shrink-0 md:block" />
        <BreadcrumbItem className="hidden shrink-0 sm:inline-flex"><BreadcrumbLink asChild><Link href={PETTY_CASH_ROOT}>Petty Cash</Link></BreadcrumbLink></BreadcrumbItem>
        {isPettyCashWorkspace(key) && <><BreadcrumbSeparator className="hidden shrink-0 sm:block" /><BreadcrumbItem className="min-w-0 overflow-hidden"><BreadcrumbPage className="truncate font-semibold" title={`Petty Cash / ${title}`}>{title}</BreadcrumbPage></BreadcrumbItem></>}
        {!isPettyCashWorkspace(key) && <BreadcrumbItem className="sm:hidden"><BreadcrumbPage>Petty Cash</BreadcrumbPage></BreadcrumbItem>}
      </BreadcrumbList></Breadcrumb></div>
      <div data-petty-cash-user className="flex h-full max-w-[48vw] shrink-0 items-center overflow-hidden px-2 sm:max-w-none sm:px-4 [&_[data-slot=sidebar-menu-button]]:min-w-0 [&_[data-slot=sidebar-menu-button]>div]:min-w-0"><NavUser user={headerUser} subsystemSlug="fm" /></div>
    </header>
    <main className="min-h-0 min-w-0 flex-1 overflow-auto p-4 md:p-6" aria-busy={loading}>
      {loading ? <PageSkeleton label={`Loading ${title}`} workspace={key} /> : error ?
        <div role="alert" className="rounded-xl border p-5"><h1 className="text-xl font-semibold">{error.status === 403 ? "Access denied" : "Petty Cash unavailable"}</h1>
          <p className="mt-2 text-sm">{error.message}</p>{error.requestId && <p className="mt-2 text-xs text-muted-foreground">Reference: {error.requestId}</p>}
          {error.status !== 403 && <Button variant="outline" className="mt-4" onClick={() => { setLoading(true); setError(null); setContext(null); setRetry(value => value + 1); }}>Retry</Button>}</div> :
        <Context.Provider value={context}>{children}</Context.Provider>}
    </main>
  </div>;
}


export function PettyCashWorkspace({ workspace }: { workspace?: PettyCashWorkspaceKey }) {
  const context = useContext(Context); const router = useRouter();
  const first = Object.keys(PETTY_CASH_WORKSPACES).find(key => context?.workspaces.some(item => item.key === key));
  useEffect(() => { if (!workspace && first) router.replace(`${PETTY_CASH_ROOT}/${first}`); }, [workspace, first, router]);
  if (!context) return null;
  if (!workspace) return first ? <PageSkeleton label="Opening your workspace" /> : <div className="rounded-xl border p-6"><h1 className="text-2xl font-semibold">Petty Cash</h1><p className="mt-2 text-muted-foreground" role="status">No Petty Cash submodules assigned. Ask your administrator to assign the required child modules.</p></div>;
  if (!context.workspaces.some(item => item.key === workspace)) return <div role="alert" className="rounded-xl border p-6"><h1 className="text-xl font-semibold">Access denied</h1><p className="mt-2">You do not have access to this Petty Cash workspace.</p></div>;
  const capabilities = context.workspaces.find(item => item.key === workspace)?.capabilities;
  if (workspace === "reports" && capabilities?.includes("READ_REPORTS")) return <PettyCashReportsModule />;
  if (workspace === "cash-count" && capabilities?.includes("READ_CASH_COUNTS")) return <PettyCashCashCountModule actorId={context.actorId} actorName={context.actorName} />;
  if (workspace === "replenishment-approval" && capabilities?.includes("READ_REPLENISHMENT_APPROVALS")) return <PettyCashReplenishmentApprovalModule actorName={context.actorName} />;
  if (workspace === "replenishment" && capabilities?.includes("READ_REPLENISHMENT")) return <PettyCashReplenishmentModule />;
  if (workspace === "onboarding" && capabilities?.includes("READ_ONBOARDING")) return <PettyCashOnboardingModule requesterName={context.actorName} canSubmitFund={capabilities.includes("SUBMIT_FUND_REQUEST")} canEditFunds={capabilities.includes("EDIT_PENDING_FUNDS")} canDeleteFunds={capabilities.includes("DELETE_PENDING_FUNDS")} canEditSettings={capabilities.includes("EDIT_SETTINGS")} />;
  if (workspace === "disbursement" && capabilities?.includes("READ_VOUCHER_DRAFTS")) return <PettyCashDisbursementModule canEdit={capabilities.includes("EDIT_VOUCHER_DRAFTS")} operational={capabilities.includes("OPERATE_VOUCHERS")} actorName={context.actorName} />;
  if (workspace === "onboarding-approval" && capabilities?.includes("READ_FUND_APPROVALS")) return <PettyCashOnboardingApprovalModule actorName={context.actorName} canDecide={capabilities.includes("DECIDE_FUND_REQUESTS")} changesEnabled={capabilities.includes("DECIDE_FUND_CHANGES")} />;
  if (workspace === "master-list" && capabilities?.includes("READ_FUND_MASTER")) return <Suspense fallback={<PageSkeleton label="Loading Master List" workspace="master-list" />}><PettyCashFundsModule canRequest={capabilities.includes("REQUEST_FUND_CHANGES")} /></Suspense>;
  return <section className="space-y-4"><div><h1 className="text-2xl font-semibold tracking-tight">{PETTY_CASH_WORKSPACES[workspace].title}</h1>
    <p className="mt-2 text-sm text-muted-foreground">{PETTY_CASH_WORKSPACES[workspace].description}</p></div>
    <div className="rounded-xl border bg-card p-5"><h2 className="font-medium">Foundation only</h2><p className="mt-2 text-sm text-muted-foreground">This workspace is registered and access is verified. Its operational workflow will be delivered in a later increment.</p></div>
  </section>;
}
