import type { ReactNode } from "react";
import { PettyCashLayout } from "@/modules/financial-management/petty-cash/components/PettyCashLayout";

export const dynamic = "force-dynamic";
export default function Layout({ children }: { children: ReactNode }) { return <PettyCashLayout>{children}</PettyCashLayout>; }
