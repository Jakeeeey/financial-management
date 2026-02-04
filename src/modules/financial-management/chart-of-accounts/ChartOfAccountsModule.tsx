// src/modules/financial-management/chart-of-accounts/ChartOfAccountsModule.tsx
"use client";

import * as React from "react";
import { Plus } from "lucide-react";

import { useChartOfAccounts } from "./hooks/useChartOfAccounts";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

import ChartOfAccountsTable from "./components/ChartOfAccountsTable";
import COAFormDialog from "./components/COAFormDialog";
import DeleteConfirmDialog from "./components/DeleteConfirmDialog";

export default function ChartOfAccountsModule() {
  const coa = useChartOfAccounts();

  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deleteId, setDeleteId] = React.useState<number | null>(null);
  const [deleteLabel, setDeleteLabel] = React.useState<string>("");

  function askDelete(id: number, label: string) {
    setDeleteId(id);
    setDeleteLabel(label);
    setDeleteOpen(true);
  }

  async function confirmDelete() {
    if (!deleteId) return;
    await coa.remove(deleteId);
    setDeleteOpen(false);
    setDeleteId(null);
    setDeleteLabel("");
  }

  // NOTE: Matches your screenshots (shows Loading...)
  const addedByLabel = "Loading...";

  return (
    <div className="space-y-4">
      {/* Page header (matches your screenshot title/subtitle area) */}
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Chart of Account Management</h1>
        <p className="text-sm text-muted-foreground">Manage your chart of accounts</p>
      </div>

      <Card className="border-muted/60 bg-muted/20">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <h2 className="text-lg font-semibold">Chart of Accounts</h2>
            </div>

            <Button className="cursor-pointer" onClick={coa.openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Add Account
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {/* Search */}
          <Input
            value={coa.q}
            onChange={(e) => {
              coa.setQ(e.target.value);
              coa.setPage(1);
            }}
            placeholder="Search by account title or GL code..."
            className="bg-background"
          />

          {/* Table */}
          <ChartOfAccountsTable
            rows={coa.rows}
            loading={coa.loading}
            accountTypes={coa.accountTypes}
            balanceTypes={coa.balanceTypes}
            onEdit={(row) => coa.openEdit(row)}
          />

          <Separator />

          {/* Footer: "Showing X of Y" + pagination */}
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm text-muted-foreground">
              Showing{" "}
              <span className="font-medium text-foreground">
                {coa.rows.length}
              </span>{" "}
              of{" "}
              <span className="font-medium text-foreground">
                {coa.total}
              </span>{" "}
              items
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                className="cursor-pointer"
                disabled={!coa.canPrev}
                onClick={() => coa.setPage(coa.page - 1)}
              >
                Previous
              </Button>

              <div className="text-sm">
                Page <span className="font-medium">{coa.page}</span> of{" "}
                <span className="font-medium">{coa.pageCount}</span>
              </div>

              <Button
                variant="outline"
                className="cursor-pointer"
                disabled={!coa.canNext}
                onClick={() => coa.setPage(coa.page + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Create dialog */}
      <COAFormDialog
        open={coa.createOpen}
        onOpenChange={coa.setCreateOpen}
        mode="create"
        accountTypes={coa.accountTypes}
        balanceTypes={coa.balanceTypes}
        bsisTypes={coa.bsisTypes}
        lookupsLoading={coa.lookupsLoading}
        addedByLabel={addedByLabel}
        onCreate={coa.create}
        onUpdate={async () => {}}
      />

      {/* Edit dialog (with delete button via confirm dialog flow) */}
      <COAFormDialog
        open={coa.editState.open}
        onOpenChange={(v) => (v ? null : coa.closeEdit())}
        mode="edit"
        row={coa.editState.row || undefined}
        accountTypes={coa.accountTypes}
        balanceTypes={coa.balanceTypes}
        bsisTypes={coa.bsisTypes}
        lookupsLoading={coa.lookupsLoading}
        addedByLabel={addedByLabel}
        onCreate={async () => {}}
        onUpdate={async (id, payload) => {
          await coa.update(id, payload);
        }}
      />

      {/* Delete confirm (wired but you can trigger from wherever you want) */}
      <DeleteConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete account?"
        description={`This will permanently delete "${deleteLabel}".`}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
