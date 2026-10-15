import type { ReactNode } from "react";
import { cookies } from "next/headers";
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

const COOKIE_NAME = "vos_access_token";

function decodeJwtPayload(token: string | undefined): Record<string, unknown> | null {
  try {
    if (!token) return null;
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = payload + "=".repeat((4 - (payload.length % 4)) % 4);
    return JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
  } catch {
    return null;
  }
}

function getUser(token: string | undefined) {
  const payload = decodeJwtPayload(token);
  const pick = (...keys: string[]) => {
    for (const key of keys) {
      const value = payload?.[key];
      if (typeof value === "string" && value.trim()) return value.trim();
    }
    return "";
  };
  const first = pick("Firstname", "FirstName", "firstName", "firstname", "first_name");
  const last = pick("LastName", "Lastname", "lastName", "lastname", "last_name");
  const email = pick("email", "Email");
  return { name: [first, last].filter(Boolean).join(" ") || email || "User", email, avatar: "/avatars/shadcn.jpg" };
}

export default async function ConsignmentPageFrame({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const cookieStore = await cookies();
  const user = getUser(cookieStore.get(COOKIE_NAME)?.value);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <header className="relative z-10 flex h-14 shrink-0 items-center justify-between border-b bg-background shadow-sm sm:h-16">
        <div className="flex h-full min-w-0 items-center gap-2 overflow-hidden px-3 sm:px-4">
          <SidebarTrigger className="-ml-1 shrink-0" />
          <Separator orientation="vertical" className="mr-2 hidden h-4 shrink-0 sm:block" />
          <Breadcrumb>
            <BreadcrumbList className="min-w-0 overflow-hidden">
              <BreadcrumbItem className="hidden shrink-0 md:block">
                <BreadcrumbLink href="/fm">FM</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden shrink-0 md:block" />
              <BreadcrumbItem className="hidden shrink-0 sm:block">
                <span className="font-normal text-muted-foreground">Consignment</span>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden shrink-0 sm:block" />
              <BreadcrumbItem className="min-w-0 overflow-hidden">
                <BreadcrumbPage className="truncate font-semibold">{title}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
        <div className="flex h-full max-w-[48vw] shrink-0 items-center overflow-hidden px-2 sm:max-w-none sm:px-4">
          <NavUser user={user} />
        </div>
      </header>
      <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto bg-background">
        {children}
      </div>
    </div>
  );
}
