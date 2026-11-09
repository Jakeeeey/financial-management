import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { COOKIE_NAME, decodeJwtPayload } from "@/lib/auth-utils";
import { BankReconciliationAppHeader } from "@/modules/financial-management/treasury/bank-management/bank-reconciliation/components/BankReconciliationAppHeader";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function BankReconciliationLayout({ children }: { children: ReactNode }) {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  const payload = token ? decodeJwtPayload(token) : null;
  const pick = (keys: string[]) => {
    for (const key of keys) {
      const value = payload?.[key];
      if (typeof value === "string" && value.trim()) return value.trim();
    }
    return "";
  };
  const first = pick(["Firstname", "FirstName", "firstName", "firstname", "first_name"]);
  const last = pick(["LastName", "Lastname", "lastName", "lastname", "last_name"]);
  const email = pick(["email", "Email"]);
  const user = { name: [first, last].filter(Boolean).join(" ") || email || "User", email };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background">
      <BankReconciliationAppHeader user={user} />
      <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6">{children}</main>
    </div>
  );
}
