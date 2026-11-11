import { type BankReconciliationWorkspaceKey } from "./workspaces";
import BankReconciliationSetupModule from "./BankReconciliationSetupModule";
import BankReconciliationPostingModule from "./BankReconciliationPostingModule";
import BankReconciliationReportsModule from "./BankReconciliationReportsModule";

export default function BankReconciliationWorkspace({ workspace }: { workspace: BankReconciliationWorkspaceKey }) {
  if (workspace === "reconcile") return <BankReconciliationSetupModule />;
  if (workspace === "posting") return <BankReconciliationPostingModule />;
  return <BankReconciliationReportsModule />;
}
