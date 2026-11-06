import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function BankManagementV2Index() {
  redirect("/fm/treasury/bank-management-v2/bank-account-onboarding");
}
