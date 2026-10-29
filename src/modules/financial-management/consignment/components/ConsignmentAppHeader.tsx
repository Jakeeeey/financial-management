"use client";

import { useSelectedLayoutSegment } from "next/navigation";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { NavUser } from "@/components/shared/app-sidebar/nav-user";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";

const WORKSPACE_TITLES: Record<string, string> = {
  shipments: "Shipments",
  policies: "Policies",
  consignees: "Consignees",
  "my-submissions": "My Submissions",
  approvals: "Approvals",
  agreements: "Agreements",
};

type ConsignmentAppHeaderProps = {
  user: {
    name: string;
    email: string;
    avatar?: string;
  };
};

export function ConsignmentAppHeader({ user }: ConsignmentAppHeaderProps) {
  const segment = useSelectedLayoutSegment();
  const pageTitle = WORKSPACE_TITLES[segment ?? ""] ?? "Consignees";

  return (
    <header className="relative z-10 flex h-14 shrink-0 items-center justify-between overflow-hidden border-b bg-background shadow-sm sm:h-16">
      <div className="flex h-full min-w-0 items-center gap-2 overflow-hidden px-3 sm:px-4">
        <SidebarTrigger className="-ml-1 shrink-0" />
        <Separator orientation="vertical" className="mr-2 hidden shrink-0 data-[orientation=vertical]:h-4 sm:block" />

        <div className="min-w-0 overflow-hidden">
          <Breadcrumb>
            <BreadcrumbList className="min-w-0 overflow-hidden">
              <BreadcrumbItem className="hidden shrink-0 md:block">
                <BreadcrumbLink href="#">FM</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden shrink-0 md:block" />
              <BreadcrumbItem className="shrink-0">
                <span>Consignment</span>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="shrink-0" />
              <BreadcrumbItem className="min-w-0 overflow-hidden">
                <BreadcrumbPage className="max-w-[30vw] truncate md:max-w-none">{pageTitle}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </div>

      <div className="flex h-full max-w-[48vw] shrink-0 items-center overflow-hidden px-2 sm:max-w-none sm:px-4">
        <NavUser user={user} />
      </div>
    </header>
  );
}
