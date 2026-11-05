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
import { ExpenseInspectorV2Module } from "@/modules/financial-management/treasury/expenses-v2/expense-inspector-v2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE_NAME = "vos_access_token";

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;

    const p = parts[1];
    const b64 = p.replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);

    const json = Buffer.from(padded, "base64").toString("utf8");
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function pickString(obj: Record<string, unknown> | null | undefined, keys: string[]): string {
  for (const k of keys) {
    const v = obj ? obj[k] : undefined;
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

function buildHeaderUserFromToken(token: string | null | undefined) {
  const payload = token ? decodeJwtPayload(token) : null;

  const first = pickString(payload, [
    "Firstname",
    "FirstName",
    "first_name",
    "given_name",
  ]);
  const last = pickString(payload, [
    "Lastname",
    "LastName",
    "last_name",
    "family_name",
  ]);
  const fallbackName = [first, last].filter(Boolean).join(" ").trim();

  const name =
    pickString(payload, ["name", "FullName", "full_name"]) ||
    fallbackName ||
    "User";

  const email =
    pickString(payload, ["email", "Email", "user_email"]) ||
    "user@example.com";

  const avatar =
    pickString(payload, ["avatar", "picture", "photo", "image"]) || "";

  return { name, email, avatar };
}

export default async function ExpenseInspectorV2Page() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  const user = buildHeaderUserFromToken(token);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <header className="relative z-10 flex h-14 shrink-0 items-center justify-between border-b shadow-sm bg-background sm:h-16 overflow-hidden px-4">
        <div className="flex h-full min-w-0 items-center gap-2 overflow-hidden">
          <SidebarTrigger className="-ml-1 shrink-0 cursor-pointer" />
          <Separator orientation="vertical" className="hidden sm:block mr-2 data-[orientation=vertical]:h-4 shrink-0" />
          <Breadcrumb>
            <BreadcrumbList className="min-w-0 overflow-hidden">
              <BreadcrumbItem className="hidden md:block shrink-0">
                <BreadcrumbLink href="/fm/dashboard">
                  Financial Management
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block shrink-0" />
              <BreadcrumbItem className="hidden md:block shrink-0">
                <BreadcrumbLink href="#">Treasury</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block shrink-0" />
              <BreadcrumbItem className="hidden md:block shrink-0">
                <BreadcrumbLink href="#">Expenses V2</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block shrink-0" />
              <BreadcrumbItem className="min-w-0 overflow-hidden">
                <BreadcrumbPage className="truncate max-w-[56vw] sm:max-w-[60vw] md:max-w-none">
                  Expense Inspector V2
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        <div className="flex h-full items-center px-2 sm:px-4 shrink-0 max-w-[48vw] sm:max-w-none overflow-hidden">
          <NavUser user={user} />
        </div>
      </header>

      <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-2 sm:p-4">
        <ExpenseInspectorV2Module />
      </main>
    </div>
  );
}
