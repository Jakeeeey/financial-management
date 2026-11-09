import { BANK_RECONCILIATION_WORKSPACES, type BankReconciliationWorkspaceKey } from "./workspaces";
import BankReconciliationSetupModule from "./BankReconciliationSetupModule";

export default function BankReconciliationWorkspace({ workspace }: { workspace: BankReconciliationWorkspaceKey }) {
  if (workspace === "reconcile") return <BankReconciliationSetupModule />;
  const { title, description } = BANK_RECONCILIATION_WORKSPACES[workspace];

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
        The {title} workflow will be implemented in a later delivery.
      </div>
    </section>
  );
}
