"use client";

import * as React from "react";
import type { CCMRow } from "../utils/types";
import { formatPHP, toNumberSafe } from "../utils/format";

import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

type Props = {
    rows: CCMRow[];
    loading: boolean;
    selectedIds: number[];
    onToggle: (id: number, checked: boolean) => void;
    onToggleAll: (checked: boolean) => void;
};

export function AvailableCCMTable({
                                      rows,
                                      loading,
                                      selectedIds,
                                      onToggle,
                                      onToggleAll,
                                  }: Props) {
    const selectedSet = React.useMemo(() => new Set(selectedIds), [selectedIds]);

    const allChecked = rows.length > 0 && rows.every((r) => selectedSet.has(r.id));
    const someChecked = rows.some((r) => selectedSet.has(r.id)) && !allChecked;

    return (
        <div className="rounded-xl border bg-background">
            <ScrollArea className="w-full">
                <div className="min-w-[900px]">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[70px]">
                                    <Checkbox
                                        checked={allChecked ? true : someChecked ? "indeterminate" : false}
                                        onCheckedChange={(v) => onToggleAll(Boolean(v))}
                                        aria-label="Select all"
                                    />
                                </TableHead>
                                <TableHead className="w-[160px]">Memo #</TableHead>
                                <TableHead className="w-[520px]">Reason</TableHead>
                                <TableHead className="w-[160px] text-right">Amount</TableHead>
                                <TableHead className="w-[180px]">Status</TableHead>
                            </TableRow>
                        </TableHeader>

                        <TableBody>
                            {loading ? (
                                Array.from({ length: 8 }).map((_, i) => (
                                    <TableRow key={i}>
                                        {Array.from({ length: 5 }).map((__, j) => (
                                            <TableCell key={j}>
                                                <Skeleton className="h-4 w-full" />
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                ))
                            ) : rows.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                                        No available customer memos for this supplier.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                rows.map((r) => {
                                    const checked = selectedSet.has(r.id);
                                    const amount = formatPHP(toNumberSafe(r.amount));
                                    return (
                                        <TableRow key={r.id}>
                                            <TableCell>
                                                <Checkbox
                                                    checked={checked}
                                                    onCheckedChange={(v) => onToggle(r.id, Boolean(v))}
                                                    aria-label={`Select ${r.memo_number}`}
                                                />
                                            </TableCell>

                                            <TableCell className="font-mono text-xs">{r.memo_number || "—"}</TableCell>

                                            <TableCell className="max-w-[520px]">
                                                <div className="truncate text-sm" title={r.reason ?? ""}>
                                                    {r.reason ?? "—"}
                                                </div>
                                            </TableCell>

                                            <TableCell className="text-right font-mono text-xs">{amount}</TableCell>

                                            <TableCell>
                                                <Badge variant="secondary">{r.status ?? "—"}</Badge>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </div>

                <ScrollBar orientation="horizontal" />
            </ScrollArea>
        </div>
    );
}
