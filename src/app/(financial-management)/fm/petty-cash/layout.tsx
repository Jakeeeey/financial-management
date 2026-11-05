import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { COOKIE_NAME, decodeJwtPayload } from "@/lib/auth-utils";
import { PettyCashLayout } from "@/modules/financial-management/petty-cash/components/PettyCashLayout";
import { pettyCashHeaderUser } from "@/modules/financial-management/petty-cash/utils/headerUser";

export const dynamic = "force-dynamic";
export default async function Layout({ children }: { children: ReactNode }) {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  const headerUser = pettyCashHeaderUser(token ? decodeJwtPayload(token) : null);
  return <PettyCashLayout headerUser={headerUser}>{children}</PettyCashLayout>;
}
