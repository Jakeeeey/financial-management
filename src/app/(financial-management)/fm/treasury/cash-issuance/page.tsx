import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function Page() {
    redirect("/fm/treasury/cash-issuance/preparation");
}
