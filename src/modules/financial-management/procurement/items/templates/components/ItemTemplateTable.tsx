"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "../utils/item-template-utils";
import type { ItemTemplate } from "../utils/types";

interface ItemTemplateTableProps {
  data: ItemTemplate[];
  loading: boolean;
  error: string | null;
  onEdit: (id: number) => void;
}

export function ItemTemplateTable({ data, loading, error, onEdit }: ItemTemplateTableProps) {
  if (error) {
    return <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>;
  }

  if (loading) {
    return (
      <div className="rounded-md border p-8">
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 bg-muted animate-pulse rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (!data.length) {
    return (
      <div className="rounded-md border p-8 text-center text-sm text-muted-foreground">
        No item templates found.
      </div>
    );
  }

  return (
    <div className="rounded-md border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[200px] max-w-[400px]">Name</TableHead>
            <TableHead className="w-[100px]">UOM</TableHead>
            <TableHead className="w-[150px]">Variants</TableHead>
            <TableHead className="w-[150px] text-right">Base Price</TableHead>
            <TableHead className="w-[100px]">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((tmpl) => (
            <TableRow
              key={tmpl.id}
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => onEdit(tmpl.id)}
            >
              <TableCell className="font-medium truncate max-w-[400px]">{tmpl.name}</TableCell>
              <TableCell className="text-muted-foreground">{tmpl.uom || "\u2014"}</TableCell>
              <TableCell>
                <Badge variant="secondary" className="font-mono">
                  {(tmpl as unknown as Record<string, unknown>)._variant_count as number ?? 0}
                </Badge>
              </TableCell>
              <TableCell className="text-right font-mono tabular-nums max-w-[130px] truncate">{formatCurrency(tmpl.base_price)}</TableCell>
              <TableCell>
                <Badge variant={tmpl.is_active ? "default" : "secondary"}>
                  {tmpl.is_active ? "Active" : "Inactive"}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
