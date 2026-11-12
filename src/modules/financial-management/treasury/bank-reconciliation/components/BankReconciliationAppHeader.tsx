"use client";

import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { NavUser } from "@/components/shared/app-sidebar/nav-user";
import { BANK_RECONCILIATION_ROOT, BANK_RECONCILIATION_WORKSPACES, type BankReconciliationWorkspaceKey } from "../workspaces";

export function BankReconciliationAppHeader({ user }: { user: { name: string; email: string } }) {
  const segment = useSelectedLayoutSegment();
  const workspace = BANK_RECONCILIATION_WORKSPACES[segment as BankReconciliationWorkspaceKey];

  return (
    <header className="relative z-10 flex h-14 shrink-0 items-center justify-between overflow-hidden border-b bg-background shadow-sm sm:h-16">
      <div className="flex h-full min-w-0 items-center gap-2 overflow-hidden px-3 sm:px-4">
        <SidebarTrigger className="-ml-1 shrink-0" />
        <Separator orientation="vertical" className="mr-2 hidden shrink-0 data-[orientation=vertical]:h-4 sm:block" />
        <Breadcrumb className="min-w-0 overflow-hidden">
          <BreadcrumbList className="min-w-0 flex-nowrap overflow-hidden">
            <BreadcrumbItem className="hidden shrink-0 md:block"><span>FM</span></BreadcrumbItem>
            <BreadcrumbSeparator className="hidden shrink-0 md:block" />
            <BreadcrumbItem className="hidden shrink-0 md:block"><span>Treasury</span></BreadcrumbItem>
            <BreadcrumbSeparator className="hidden shrink-0 md:block" />
            <BreadcrumbItem className="hidden shrink-0 sm:block">
              <BreadcrumbLink asChild><Link href={BANK_RECONCILIATION_ROOT}>Bank Reconciliation</Link></BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator className="hidden shrink-0 sm:block" />
            <BreadcrumbItem className="min-w-0 overflow-hidden">
              <BreadcrumbPage className="truncate">{workspace?.title ?? "Bank Reconciliation"}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>
      <div className="flex h-full max-w-[48vw] shrink-0 items-center overflow-hidden px-2 sm:max-w-none sm:px-4">
        <NavUser user={user} />
      </div>
    </header>
  );
}
