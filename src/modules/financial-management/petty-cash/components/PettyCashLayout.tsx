"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { NavUser } from "@/components/shared/app-sidebar/nav-user";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { PETTY_CASH_ROOT, PETTY_CASH_WORKSPACES, isPettyCashWorkspace, type PettyCashContext, type PettyCashWorkspaceKey } from "../types";
import { loadPettyCashContext, PettyCashApiError } from "../providers/foundation.api";

const Context = createContext<PettyCashContext | null>(null);

export function PettyCashLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return <PettyCashPageAccess key={pathname}>{children}</PettyCashPageAccess>;
}

function PettyCashPageAccess({ children }: { children: ReactNode }) {
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
        if (cause instanceof PettyCashApiError && cause.status === 401) { router.replace("/login"); return; }
        setError(cause instanceof PettyCashApiError ? cause : new PettyCashApiError("Petty Cash is temporarily unavailable. Please retry.", 503));
      }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [retry, router]);
  return <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-background">
    <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b px-4">
      <div className="flex min-w-0 items-center gap-3"><SidebarTrigger /><Breadcrumb><BreadcrumbList>
        <BreadcrumbItem><BreadcrumbLink asChild><Link href="/fm">FM</Link></BreadcrumbLink></BreadcrumbItem><BreadcrumbSeparator />
        <BreadcrumbItem><BreadcrumbLink asChild><Link href={PETTY_CASH_ROOT}>Petty Cash</Link></BreadcrumbLink></BreadcrumbItem>
        {isPettyCashWorkspace(key) && <><BreadcrumbSeparator /><BreadcrumbItem><BreadcrumbPage>{title}</BreadcrumbPage></BreadcrumbItem></>}
      </BreadcrumbList></Breadcrumb></div>
      {context && <NavUser user={{ name: context.actorName, email: "" }} />}
    </header>
    <main className="min-h-0 min-w-0 flex-1 overflow-auto p-4 md:p-6" aria-busy={loading}>
      {loading ? <p role="status" className="text-sm text-muted-foreground">Loading Petty Cash access…</p> : error ?
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
  if (!workspace) return <div className="rounded-xl border p-6"><h1 className="text-2xl font-semibold">Petty Cash</h1>
    <p className="mt-2 text-muted-foreground" role="status">{first ? "Opening your workspace…" : "No Petty Cash submodules assigned. Ask your administrator to assign the required child modules."}</p></div>;
  if (!context.workspaces.some(item => item.key === workspace)) return <div role="alert" className="rounded-xl border p-6"><h1 className="text-xl font-semibold">Access denied</h1><p className="mt-2">You do not have access to this Petty Cash workspace.</p></div>;
  return <section className="space-y-4"><div><h1 className="text-2xl font-semibold tracking-tight">{PETTY_CASH_WORKSPACES[workspace].title}</h1>
    <p className="mt-2 text-sm text-muted-foreground">{PETTY_CASH_WORKSPACES[workspace].description}</p></div>
    <div className="rounded-xl border bg-card p-5"><h2 className="font-medium">Foundation only</h2><p className="mt-2 text-sm text-muted-foreground">This workspace is registered and access is verified. Its operational workflow will be delivered in a later increment.</p></div>
  </section>;
}
