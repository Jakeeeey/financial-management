import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { NavUser } from "@/components/shared/app-sidebar/nav-user";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AdjustingJournalEntriesModule } from "@/modules/financial-management/financial-statements/adjusting-journal-entries";
import { COOKIE_NAME, decodeJwtPayload } from "@/lib/auth-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function pickString(obj: Record<string, unknown> | null | undefined, keys: string[]): string {
  for (const key of keys) {
    const value = obj ? obj[key] : undefined;
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function buildHeaderUserFromToken(token: string | null | undefined) {
  const payload = token ? decodeJwtPayload(token) : null;
  const first = pickString(payload, ["Firstname", "FirstName", "firstName", "firstname", "first_name"]);
  const last = pickString(payload, ["LastName", "Lastname", "lastName", "lastname", "last_name"]);
  const email = pickString(payload, ["email", "Email"]);
  const name = [first, last].filter(Boolean).join(" ") || email || "User";

  return {
    name,
    email: email || "",
    avatar: "/avatars/shadcn.jpg",
  };
}

export default async function Page() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value ?? null;

  if (!token) {
    redirect("/login?next=/fm/financial-statements/adjusting-journal-entries");
  }

  const headerUser = buildHeaderUserFromToken(token);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <header className="relative z-10 flex h-14 shrink-0 items-center justify-between overflow-hidden border-b bg-background shadow-sm sm:h-16">
        <div className="flex h-full min-w-0 items-center gap-2 overflow-hidden px-3 sm:px-4">
          <SidebarTrigger className="-ml-1 shrink-0" />
          <Separator
            orientation="vertical"
            className="mr-2 hidden shrink-0 data-[orientation=vertical]:h-4 sm:block"
          />

          <div className="min-w-0 overflow-hidden">
            <Breadcrumb>
              <BreadcrumbList className="min-w-0 overflow-hidden">
                <BreadcrumbItem className="hidden shrink-0 md:block">
                  <BreadcrumbLink href="#">FM</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden shrink-0 md:block" />
                <BreadcrumbItem className="hidden shrink-0 md:block">
                  <BreadcrumbLink href="#">Financial Statements</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden shrink-0 md:block" />
                <BreadcrumbItem className="min-w-0 overflow-hidden">
                  <BreadcrumbPage className="max-w-[56vw] truncate sm:max-w-[60vw] md:max-w-none">
                    Adjusting Journal Entries
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </div>

        <div className="flex h-full max-w-[48vw] shrink-0 items-center overflow-hidden px-2 sm:max-w-none sm:px-4">
          <NavUser user={headerUser} />
        </div>
      </header>

      <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
        <AdjustingJournalEntriesModule />
      </main>
    </div>
  );
}
