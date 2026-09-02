"use client";

import { Fragment, useState } from "react";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";
import { formatCurrency } from "@/modules/financial-management/procurement/items/utils/utils";
import type { ItemTemplate, ItemVariant } from "@/modules/financial-management/procurement/items/utils/types";

interface ItemTableProps {
  items: ItemTemplate[];
  variants: Record<number, ItemVariant[]>;
  onEdit: (id: number) => void;
  onEditVariant: (variantId: number) => void;
  onAddVariant: (templateId: number) => void;
  loading?: boolean;
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

export function ItemTable({ items, variants, onEdit, onEditVariant, onAddVariant, loading }: ItemTableProps) {
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
      <Table className="min-w-[700px] table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[200px] max-w-[250px]">Name</TableHead>
            <TableHead className="w-[130px]">Status</TableHead>
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
                  <TableCell>
                    <Badge variant={tmpl.is_active ? "default" : "secondary"}>
                      {tmpl.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
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
                    <TableCell colSpan={3} className="bg-muted/30 p-4">
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
                                <TableHead className="w-12" />
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {itemVariants.map((v) => (
                                <TableRow key={v.id} className="hover:bg-muted/50">
                                  <TableCell className="font-medium">
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
    </div>
  );
}
