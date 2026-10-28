import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { ConsignmentAppHeader } from "@/modules/financial-management/consignment/components/ConsignmentAppHeader";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE_NAME = "vos_access_token";

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;

    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = payload + "=".repeat((4 - (payload.length % 4)) % 4);
    return JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
  } catch {
    return null;
  }
}

function pickString(payload: Record<string, unknown> | null, keys: string[]): string {
  for (const key of keys) {
    const value = payload?.[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function buildHeaderUser(token: string | undefined) {
  const payload = token ? decodeJwtPayload(token) : null;
  const firstName = pickString(payload, ["Firstname", "FirstName", "firstName", "firstname", "first_name"]);
  const lastName = pickString(payload, ["LastName", "Lastname", "lastName", "lastname", "last_name"]);
  const email = pickString(payload, ["email", "Email"]);

  return {
    name: [firstName, lastName].filter(Boolean).join(" ") || email || "User",
    email,
    avatar: "/avatars/shadcn.jpg",
  };
}

export default async function ConsignmentLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const user = buildHeaderUser(cookieStore.get(COOKIE_NAME)?.value);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background">
      <ConsignmentAppHeader user={user} />
      <div className="min-h-0 min-w-0 flex-1 overflow-hidden bg-background">{children}</div>
    </div>
  );
}
