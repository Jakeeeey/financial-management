//src/modules/financial-management/discount-type/DiscountTypeModule.tsx
"use client";

import * as React from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

import { useDiscountTypes } from "./hooks/useDiscountTypes";
import { columns } from "./components/data-table/columns";
import { DiscountTypeDataTable } from "./components/data-table";
import { DiscountTypeTableSkeleton } from "./components/data-table/skeleton-loader";
import DiscountTypeDialog from "./components/DiscountTypeDialog";

export default function DiscountTypeModule() {
  const dt = useDiscountTypes();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-2xl font-semibold">Discount Types</div>
        </div>

        <Button onClick={dt.onCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Discount Type
        </Button>
      </div>

      <Card className="p-4">
        {dt.loading ? (
          <DiscountTypeTableSkeleton />
        ) : (
          <DiscountTypeDataTable
            columns={columns}
            data={dt.rows}
            onRowClick={(row) => dt.onEdit(row)}
          />
        )}
      </Card>

      <DiscountTypeDialog
        open={dt.open}
        onOpenChange={dt.setOpen}
        editing={dt.editing}
        lineDiscounts={dt.lines}
        onSave={dt.save}
        onDelete={dt.remove}
      />
    </div>
  );
}
