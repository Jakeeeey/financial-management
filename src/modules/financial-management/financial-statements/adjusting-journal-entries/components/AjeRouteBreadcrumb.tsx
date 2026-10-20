"use client";

import { usePathname } from "next/navigation";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

const routeLabels: Record<string, string> = {
  new: "New Adjusting Entry",
  posting: "Posting of Entries",
  "audit-trail": "Audit Trail",
  summary: "Summary",
};

export function AjeRouteBreadcrumb() {
  const pathname = usePathname() || "";
  const normalizedPath = pathname.replace(/\/+$/, "");
  const segments = normalizedPath.split("/");
  const route = segments[segments.length - 1];
  const currentLabel = routeLabels[route] || "Posting of Entries";

  return (
    <Breadcrumb>
      <BreadcrumbList className="min-w-0 overflow-hidden">
        <BreadcrumbItem className="hidden shrink-0 md:block">
          <span className="text-muted-foreground">FM</span>
        </BreadcrumbItem>
        <BreadcrumbSeparator className="hidden shrink-0 md:block" />
        <BreadcrumbItem className="hidden shrink-0 md:block">
          <span className="text-muted-foreground">Financial Statements</span>
        </BreadcrumbItem>
        <BreadcrumbSeparator className="hidden shrink-0 md:block" />
        <BreadcrumbItem className="shrink-0">
          <span className="text-muted-foreground">Adjusting Journal Entries</span>
        </BreadcrumbItem>
        <BreadcrumbSeparator className="shrink-0" />
        <BreadcrumbItem className="min-w-0 overflow-hidden">
          <BreadcrumbPage className="max-w-[56vw] truncate font-semibold sm:max-w-[60vw] md:max-w-none">
            {currentLabel}
          </BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}
