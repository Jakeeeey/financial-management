"use client";

import { Plus, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

import type { LookupOption } from "../types";
import { AjeSearchableSelect } from "./AjeSearchableSelect";
import { balancedTolerance, money } from "./formatters";
import type { DetailFormRow, MoneyTotals } from "./types";

type AdjustingEntryDetailsGridProps = {
  rows: DetailFormRow[];
  coaOptions: LookupOption[];
  readOnly: boolean;
  isBalanced: boolean;
  displayTotals: MoneyTotals;
  lineErrors: Array<string | null>;
  onAddRow: () => void;
  onUpdateRow: (localId: string, field: keyof Pick<DetailFormRow, "coaId" | "debit" | "credit">, value: string) => void;
  onRemoveRow: (localId: string) => void;
  isBlankDetailRow: (row: DetailFormRow) => boolean;
  parseMoney: (value: string) => number;
};

export function AdjustingEntryDetailsGrid({
  rows,
  coaOptions,
  readOnly,
  isBalanced,
  displayTotals,
  lineErrors,
  onAddRow,
  onUpdateRow,
  onRemoveRow,
  isBlankDetailRow,
  parseMoney,
}: AdjustingEntryDetailsGridProps) {
  return (
    <div className="mt-5 rounded-md border">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <div className="flex items-center gap-2">
          <div className="font-medium">Details</div>
          <Badge
            variant="outline"
            className={isBalanced ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700" : "border-destructive/30 bg-destructive/10 text-destructive"}
          >
            {isBalanced ? "Balanced" : "Imbalanced"}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {!readOnly && (
            <Button
              variant="outline"
              size="sm"
              onClick={onAddRow}
            >
              <Plus className="mr-2 size-4" />
              Add Row
            </Button>
          )}
        </div>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-90">Chart of Account</TableHead>
              <TableHead className="w-42.5 text-right">Debit</TableHead>
              <TableHead className="w-42.5 text-right">Credit</TableHead>
              <TableHead className="w-16 text-right"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, index) => {
              const rowError = lineErrors[index];
              const showRowError = !readOnly && Boolean(rowError) && !isBlankDetailRow(row);
              return (
                <TableRow key={row.localId}>
                  <TableCell>
                    <AjeSearchableSelect
                      options={coaOptions}
                      value={row.coaId}
                      onValueChange={(value) => onUpdateRow(row.localId, "coaId", value)}
                      placeholder="Select account"
                      disabled={readOnly}
                    />
                    {showRowError && (
                      <div className="mt-1 text-xs text-destructive">{rowError}</div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={row.debit}
                      onChange={(event) => onUpdateRow(row.localId, "debit", event.target.value)}
                      className="text-right font-mono"
                      disabled={readOnly || parseMoney(row.credit) > 0}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={row.credit}
                      onChange={(event) => onUpdateRow(row.localId, "credit", event.target.value)}
                      className="text-right font-mono"
                      disabled={readOnly || parseMoney(row.debit) > 0}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    {!readOnly && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground"
                        onClick={() => onRemoveRow(row.localId)}
                        disabled={rows.length <= 1}
                      >
                        <X className="size-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <div className="sticky bottom-0 z-10 grid gap-3 border-t bg-background/95 px-3 py-3 text-sm shadow-[0_-8px_16px_rgba(15,23,42,0.06)] backdrop-blur md:grid-cols-3">
        <div className="flex items-center justify-between rounded-md border bg-background px-3 py-2">
          <span className="text-muted-foreground">Total Debits</span>
          <span className="font-mono font-semibold">{money(displayTotals.totalDebit)}</span>
        </div>
        <div className="flex items-center justify-between rounded-md border bg-background px-3 py-2">
          <span className="text-muted-foreground">Total Credits</span>
          <span className="font-mono font-semibold">{money(displayTotals.totalCredit)}</span>
        </div>
        <div className="flex items-center justify-between rounded-md border bg-background px-3 py-2">
          <span className="flex items-center gap-2 text-muted-foreground">
            Variance
            <Badge
              variant="outline"
              className={isBalanced ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700" : "border-destructive/30 bg-destructive/10 text-destructive"}
            >
              {isBalanced ? "Balanced" : "Variance"}
            </Badge>
          </span>
          <span className={cn("font-mono font-semibold", Math.abs(displayTotals.variance) >= balancedTolerance && "text-destructive")}>
            {money(displayTotals.variance)}
          </span>
        </div>
      </div>
    </div>
  );
}
