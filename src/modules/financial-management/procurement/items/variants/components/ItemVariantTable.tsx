"use client";

import { useRouter } from "next/navigation";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "../utils/item-variant-utils";
import type { ItemVariant } from "../utils/types";

interface ItemVariantTableProps {
  data: ItemVariant[];
  loading: boolean;
  error: string | null;
}

export function ItemVariantTable({ data, loading, error }: ItemVariantTableProps) {
  const router = useRouter();

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
        No variants found.
      </div>
    );
  }

  return (
    <div className="rounded-md border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[200px] max-w-[250px]">Name</TableHead>
            <TableHead className="min-w-[150px] max-w-[250px] truncate">Template</TableHead>
            <TableHead className="w-[100px]">SKU</TableHead>
            <TableHead className="w-[150px] text-right">List Price</TableHead>
            <TableHead className="w-[100px]">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((v) => (
            <TableRow
              key={v.id}
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => router.push(`/fm/procurement/items/variants/${v.id}`)}
            >
              <TableCell className="font-medium truncate max-w-[250px]">{v.name}</TableCell>
              <TableCell className="text-muted-foreground truncate max-w-[250px]">{v._template_name ?? "\u2014"}</TableCell>
              <TableCell className="text-muted-foreground font-mono text-xs">{v.sku || "\u2014"}</TableCell>
              <TableCell className="text-right font-mono tabular-nums max-w-[130px] truncate">{formatCurrency(v.list_price)}</TableCell>
              <TableCell>
                <Badge variant={v.active ? "default" : "secondary"}>
                  {v.active ? "Active" : "Inactive"}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
