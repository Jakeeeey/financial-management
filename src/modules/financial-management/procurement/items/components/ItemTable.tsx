"use client";

import { Fragment, useState } from "react";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pencil, Copy, Trash2 } from "lucide-react";
import { formatCurrency, formatDateTime } from "@/modules/financial-management/procurement/items/utils/utils";
import type { ItemTemplate, ItemVariant } from "@/modules/financial-management/procurement/items/utils/types";

interface ItemTableProps {
  items: ItemTemplate[];
  variants: Record<number, ItemVariant[]>;
  onEdit: (id: number) => void;
  onEditVariant: (variantId: number) => void;
  onAddVariant: (templateId: number) => void;
  onCloneVariant?: (variant: ItemVariant) => void;
  onDeleteVariant?: (variant: ItemVariant) => void;
  deletingVariantId?: number | null;
  loading?: boolean;
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`h-4 w-4 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
    >
      <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
    </svg>
  );
}

export function ItemTable({ items, variants, onEdit, onEditVariant, onAddVariant, onCloneVariant, onDeleteVariant, deletingVariantId, loading, total, page, pageSize, onPageChange }: ItemTableProps) {
  const [expandedId, setExpandedId] = useState<number | null>(null);

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

  if (!items.length) {
    return (
      <div className="rounded-md border p-8 text-center text-sm text-muted-foreground">No items found.</div>
    );
  }

  return (
    <div className="rounded-md border overflow-x-auto">
      <Table className="min-w-[1100px] table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[200px] max-w-[250px]">Name</TableHead>
            <TableHead className="min-w-[220px] max-w-[300px]">Description</TableHead>
            <TableHead className="w-[130px]">Status</TableHead>
            <TableHead className="w-[150px] whitespace-nowrap">Created At</TableHead>
            <TableHead className="w-[110px] whitespace-nowrap">Created By</TableHead>
            <TableHead className="w-[150px] whitespace-nowrap">Updated At</TableHead>
            <TableHead className="w-[110px] whitespace-nowrap">Updated By</TableHead>
            <TableHead className="w-16" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((tmpl) => {
            const expanded = expandedId === tmpl.id;
            const itemVariants = variants[tmpl.id] ?? [];

            return (
              <Fragment key={tmpl.id}>
                <TableRow
                  className="group cursor-pointer hover:bg-muted/50"
                  onClick={() => setExpandedId(expanded ? null : tmpl.id)}
                >
                  <TableCell className="font-medium">
                    <span className="block truncate max-w-[250px]">{tmpl.name}</span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    <span className="block truncate max-w-[300px]">{tmpl.description || "—"}</span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={tmpl.is_active ? "default" : "secondary"}>
                      {tmpl.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs whitespace-nowrap tabular-nums">{formatDateTime(tmpl.created_at)}</TableCell>
                  <TableCell className="text-muted-foreground text-xs whitespace-nowrap truncate max-w-[110px]">{tmpl.created_by || "—"}</TableCell>
                  <TableCell className="text-muted-foreground text-xs whitespace-nowrap tabular-nums">{formatDateTime(tmpl.updated_at)}</TableCell>
                  <TableCell className="text-muted-foreground text-xs whitespace-nowrap truncate max-w-[110px]">{tmpl.updated_by || "—"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label={`Edit ${tmpl.name}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onEdit(tmpl.id);
                        }}
                      >
                        <EditIcon />
                      </Button>
                      <span aria-hidden="true" className="text-muted-foreground">
                        <ChevronIcon expanded={expanded} />
                      </span>
                    </div>
                  </TableCell>
                </TableRow>

                {expanded && (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={8} className="bg-muted/30 p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-muted-foreground">Variants</span>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => onAddVariant(tmpl.id)}
                        >
                          Add Variant
                        </Button>
                      </div>

                      {itemVariants.length ? (
                        <div className="rounded-md border bg-background overflow-x-auto">
                          <Table className="min-w-[600px] table-fixed">
                            <TableHeader>
                              <TableRow>
                                <TableHead className="min-w-[160px] max-w-[220px]">Variant Name</TableHead>
                                <TableHead className="min-w-[80px]">UOM</TableHead>
                                <TableHead className="min-w-[100px]">SKU</TableHead>
                                <TableHead className="min-w-[100px] text-right">List Price</TableHead>
                                <TableHead className="w-[110px]">Status</TableHead>
                                <TableHead className="w-[132px] text-right">Actions</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {itemVariants.map((v) => (
                                <TableRow key={v.id} className="hover:bg-muted/50">
                                  <TableCell className="text-muted-foreground select-text">
                                    <span className="block truncate max-w-[220px]">{v.name}</span>
                                  </TableCell>
                                  <TableCell className="text-muted-foreground">{v._uom_name || "\u2014"}</TableCell>
                                  <TableCell className="text-muted-foreground font-mono text-xs">
                                    {v.sku || "\u2014"}
                                  </TableCell>
                                  <TableCell className="text-right font-mono tabular-nums max-w-[130px] truncate">
                                    {formatCurrency(v.list_price)}
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant={v.active ? "default" : "secondary"}>
                                      {v.active ? "Active" : "Inactive"}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <div className="flex items-center justify-end gap-1">
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                        aria-label={`Edit variant ${v.name}`}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onEditVariant(v.id);
                                        }}
                                      >
                                        <Pencil className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                        aria-label={`Clone variant ${v.name}`}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onCloneVariant?.(v);
                                        }}
                                      >
                                        <Copy className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-muted-foreground hover:text-foreground disabled:opacity-40"
                                        aria-label={`Delete variant ${v.name}`}
                                        title={itemVariants.length <= 1 ? "Each item needs at least one variant" : undefined}
                                        disabled={itemVariants.length <= 1 || deletingVariantId === v.id}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onDeleteVariant?.(v);
                                        }}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground">No variants for this item.</div>
                      )}
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
      {total > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 py-2 text-xs text-muted-foreground border-t">
          <span>
            Showing {Math.min((page - 1) * pageSize + 1, total)}–{Math.min(page * pageSize, total)} of {total} record{total !== 1 ? "s" : ""} · Page {page} of {Math.max(1, Math.ceil(total / pageSize))}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= Math.max(1, Math.ceil(total / pageSize))}
              onClick={() => onPageChange(page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
