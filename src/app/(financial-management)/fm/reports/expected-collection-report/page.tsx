import { cookies } from "next/headers";
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { NavUser } from "@/components/shared/app-sidebar/nav-user";
import { decodeJwtPayload, COOKIE_NAME } from "@/lib/auth-utils";
import ExpectedCollectionReportModule from "@/modules/financial-management/reports/expected-collection-report/ExpectedCollectionReportModule";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function Page() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  const payload = token ? decodeJwtPayload(token) : null;
  const firstName = typeof payload?.FirstName === "string" ? payload.FirstName.trim() : "";
  const lastName = typeof payload?.LastName === "string" ? payload.LastName.trim() : "";
  const email = typeof payload?.email === "string" ? payload.email.trim() : "";
  const name = [firstName, lastName].filter(Boolean).join(" ") || email || "User";

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <header className="relative z-10 flex h-14 shrink-0 items-center justify-between overflow-hidden border-b bg-background shadow-sm sm:h-16">
        <div className="flex h-full min-w-0 items-center gap-2 overflow-hidden px-3 sm:px-4">
          <SidebarTrigger className="-ml-1 shrink-0" />
          <Separator orientation="vertical" className="mr-2 hidden h-4 sm:block" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden text-muted-foreground md:block">FM</BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem className="hidden text-muted-foreground md:block">Reports</BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem><BreadcrumbPage>Expected Collection Report</BreadcrumbPage></BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
        <div className="flex h-full shrink-0 items-center px-2 sm:px-4">
          <NavUser user={{ name, email, avatar: "/vertex_logo_black.png" }} />
        </div>
      </header>

      <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-2 sm:p-4">
        <ExpectedCollectionReportModule />
      </main>
    </div>
  );
}
