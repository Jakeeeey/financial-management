"use client";

import * as React from "react";
import { Plus } from "lucide-react";

import { useDeliveryTerms } from "./hooks/useDeliveryTerms";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

import DeliveryTermsTable from "./components/DeliveryTermsTable";
import DeliveryTermsFormDialog from "./components/DeliveryTermsFormDialog";

export default function DeliveryTermsModule() {
  const dt = useDeliveryTerms();

  return (
    <div className="space-y-4">
      {/* Title + Add Button */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">
            Delivery Term Management
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage your delivery terms
          </p>
        </div>

        <Button className="cursor-pointer" onClick={dt.openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Add Delivery Term
        </Button>
      </div>

      {/* Card with Search + Table */}
      <Card className="border-muted/60 bg-muted/20">
        <CardContent className="space-y-3 pt-6">
          {/* Search */}
          <Input
            value={dt.q}
            onChange={(e) => {
              dt.setQ(e.target.value);
              dt.setPage(1);
            }}
            placeholder="Search by name or description..."
            className="bg-background"
          />

          {/* Table */}
          <DeliveryTermsTable
            rows={dt.rows}
            loading={dt.loading}
            onEdit={(row) => dt.openEdit(row)}
          />

          <Separator />

          {/* Footer: "Showing X of Y" + pagination */}
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm text-muted-foreground">
              Showing{" "}
              <span className="font-medium text-foreground">
                {dt.rows.length}
              </span>{" "}
              of{" "}
              <span className="font-medium text-foreground">{dt.total}</span>{" "}
              items
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                className="cursor-pointer"
                disabled={!dt.canPrev}
                onClick={() => dt.setPage(dt.page - 1)}
              >
                Previous
              </Button>

              <div className="text-sm">
                Page <span className="font-medium">{dt.page}</span> of{" "}
                <span className="font-medium">{dt.pageCount}</span>
              </div>

              <Button
                variant="outline"
                className="cursor-pointer"
                disabled={!dt.canNext}
                onClick={() => dt.setPage(dt.page + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Create dialog */}
      <DeliveryTermsFormDialog
        open={dt.createOpen}
        onOpenChange={dt.setCreateOpen}
        mode="create"
        onCreate={dt.create}
        onUpdate={async () => {}}
      />

      {/* Edit dialog */}
      <DeliveryTermsFormDialog
        open={dt.editState.open}
        onOpenChange={(v) => (v ? null : dt.closeEdit())}
        mode="edit"
        row={dt.editState.row || undefined}
        onCreate={async () => {}}
        onUpdate={async (id, payload) => {
          await dt.update(id, payload);
        }}
      />
    </div>
  );
}
