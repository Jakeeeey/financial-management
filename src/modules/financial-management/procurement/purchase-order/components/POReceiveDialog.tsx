"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { Loader2, Plus, X, AlertCircle, ChevronDown, ChevronRight, PackageCheck } from "lucide-react";
import type { PurchaseOrderItem } from "../utils/types";
import { toNum } from "../utils/po-utils";

interface Department {
  department_id: number;
  department_name: string;
}

interface UserRow {
  user_id: number;
  user_department: number | null;
  full_name: string;
}

interface Split {
  department_id: number;
  user_id: number | null;
  qty: number;
}

interface ReceiveRow {
  key: string;
  po_item_id: number;
  item_template_id: number;
  item_variant_id: number | null;
  item_name: string;
  uom: string;
  ordered_qty: number;
  unit_cost: number;
  currency: string;
  received_so_far: number;
  remaining: number;
  received_today: number;
  splits: Split[];
}

interface POReceiveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  poId: number;
  poItems: PurchaseOrderItem[];
  onSaveSuccess: () => void;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: `HTTP ${res.status}` }));
    throw new Error(err.detail || err.message || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

async function getAlreadyReceivedMap(poId: number): Promise<Record<number, number>> {
  const recvRes = await fetchJson<{ data: { id: number }[] }>(
    `/api/fm/procurement/purchase-order/lookups/receiving?purchase_order_id=${poId}`
  );
  const recvIds = (recvRes.data || []).map((r) => r.id);
  if (!recvIds.length) return {};

  const linesRes = await fetchJson<{ data: { po_item_id: number; qty_received: number }[] }>(
    `/api/fm/procurement/purchase-order/lookups/receiving-lines?receiving_ids=${recvIds.join(",")}`
  );
  const result: Record<number, number> = {};
  for (const line of linesRes.data || []) {
    result[Number(line.po_item_id)] = (result[Number(line.po_item_id)] || 0) + Number(line.qty_received || 0);
  }
  return result;
}

export function POReceiveDialog({ open, onOpenChange, poId, poItems, onSaveSuccess }: POReceiveDialogProps) {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [referenceNo, setReferenceNo] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const baseRows = useMemo<ReceiveRow[]>(
    () =>
      (poItems || []).map((item) => ({
        key: String(item.id ?? item.po_item_id ?? Math.random()),
        po_item_id: item.id ?? item.po_item_id ?? 0,
        item_template_id: typeof item.item_template_id === "object" && item.item_template_id
          ? Number((item.item_template_id as { id?: number }).id ?? 0)
          : Number(item.item_template_id ?? 0),
        item_variant_id: typeof item.item_variant_id === "object" && item.item_variant_id
          ? Number((item.item_variant_id as { id?: number }).id ?? null)
          : (item.item_variant_id != null ? Number(item.item_variant_id) : null),
        item_name: item.item_name ?? (() => {
          if (typeof item.item_template_id === "object" && item.item_template_id && "name" in item.item_template_id) {
            return (item.item_template_id as { name?: string }).name ?? "Item";
          }
          return "Item";
        })(),
        uom: item.uom ?? "",
        ordered_qty: toNum(item.qty),
        unit_cost: toNum(item.unit_price),
        currency: "PHP",
        received_so_far: 0,
        remaining: toNum(item.qty),
        received_today: 0,
        splits: [],
      })),
    [poItems]
  );

  const [rows, setRows] = useState<ReceiveRow[]>([]);

  useEffect(() => {
    if (!open) return;

    const load = async () => {
      setLoading(true);
      setError("");
      setExpandedRows(new Set());
      try {
        const [loadedDepartments, loadedUsers] = await Promise.all([
          fetchJson<{ data: Department[] }>("/api/fm/procurement/purchase-order/lookups/departments"),
          fetchJson<{ data: UserRow[] }>("/api/fm/procurement/purchase-order/lookups/users"),
        ]);
        setDepartments(loadedDepartments.data);
        setUsers(loadedUsers.data);

        const recMap = await getAlreadyReceivedMap(poId);
        const computed = baseRows
          .map((row) => {
            const receivedSoFar = Number(recMap[row.po_item_id] || 0);
            const remaining = Math.max(0, row.ordered_qty - receivedSoFar);
            return { ...row, received_so_far: receivedSoFar, remaining, received_today: 0, splits: [] };
          })
          .filter((row) => row.remaining > 0);
        setRows(computed);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load data");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [open, poId, baseRows]);

  const toggleExpand = useCallback((key: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
        setRows((r) =>
          r.map((row) =>
            row.key === key && row.splits.length === 0
              ? { ...row, splits: [{ department_id: departments[0]?.department_id ?? 0, user_id: null, qty: 0 }] }
              : row
          )
        );
      }
      return next;
    });
  }, [departments]);

  const patchRow = useCallback((key: string, patch: Partial<ReceiveRow>) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.key !== key) return row;
        const next = { ...row, ...patch };
        if (patch.received_today !== undefined) {
          next.received_today = Math.max(0, Math.min(row.remaining, Number(patch.received_today || 0)));
        }
        return next;
      })
    );
  }, []);

  const addSplit = useCallback(
    (key: string) => {
      setRows((prev) =>
        prev.map((row) =>
          row.key === key
            ? { ...row, splits: [...row.splits, { department_id: departments[0]?.department_id ?? 0, user_id: null, qty: 0 }] }
            : row
        )
      );
    },
    [departments]
  );

  const updateSplit = useCallback(
    (key: string, idx: number, patch: Partial<Split>) => {
      setRows((prev) =>
        prev.map((row) => {
          if (row.key !== key) return row;
          const old = row.splits[idx];
          if (!old) return row;
          const nextSplit: Split = {
            ...old,
            ...patch,
            qty: Number(patch.qty ?? old.qty),
          };
          if (patch.department_id != null && nextSplit.user_id != null) {
            const chosenUser = users.find((u) => u.user_id === nextSplit.user_id);
            if (chosenUser && Number(chosenUser.user_department ?? -1) !== Number(patch.department_id)) {
              nextSplit.user_id = null;
            }
          }
          const nextSplits = row.splits.map((s, i) => (i === idx ? nextSplit : s));
          return { ...row, splits: nextSplits };
        })
      );
    },
    [users]
  );

  const removeSplit = useCallback((key: string, idx: number) => {
    setRows((prev) =>
      prev.map((row) =>
        row.key === key ? { ...row, splits: row.splits.filter((_, i) => i !== idx) } : row
      )
    );
  }, []);

  const valid = useMemo(() => {
    for (const row of rows) {
      if (row.received_today > row.remaining) return false;
      if (row.received_today < 0) return false;
      const sum = row.splits.reduce((total, split) => total + (Number(split.qty) || 0), 0);
      if (sum !== Number(row.received_today || 0)) return false;
    }
    return true;
  }, [rows]);

  const hasWork = useMemo(() => rows.some((row) => Number(row.received_today) > 0), [rows]);
  const allItemsFulfilled = rows.length === 0;

  const handleSave = async () => {
    try {
      setSaving(true);
      setError("");

      if (!rows.some((row) => row.received_today > 0)) {
        setError("Nothing to receive.");
        return;
      }

      const res = await fetch(`/api/fm/procurement/purchase-order/${poId}/receive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows: rows.filter((r) => r.received_today > 0).map((r) => ({
            po_item_id: r.po_item_id,
            item_template_id: r.item_template_id,
            item_variant_id: r.item_variant_id,
            uom: r.uom,
            remaining: r.remaining,
            received_today: r.received_today,
            unit_cost: r.unit_cost,
            currency: r.currency,
            splits: r.splits,
          })),
          reference_no: referenceNo || null,
          notes: notes || null,
        }),
        cache: "no-store",
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: `HTTP ${res.status}` }));
        throw new Error(err.detail || err.message || "Failed to save receiving");
      }

      onSaveSuccess();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save receiving");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle>Receive &amp; Assign Items</DialogTitle>
          <DialogDescription>Record received quantities and assign items to departments or users.</DialogDescription>
        </DialogHeader>

        {error && (
          <div className="mx-6 mt-3 flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="flex flex-col gap-2 px-6 pt-4 pb-3 sm:flex-row">
          <div className="sm:w-56">
            <Label htmlFor="reference-no" className="text-xs">Reference No.</Label>
            <Input id="reference-no" placeholder="DR / SI number" className="h-8 text-sm" value={referenceNo} onChange={(e) => setReferenceNo(e.target.value)} />
          </div>
          <div className="flex-1">
            <Label htmlFor="notes" className="text-xs">Notes / Remarks</Label>
            <Input id="notes" placeholder="Optional remarks..." className="h-8 text-sm" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {allItemsFulfilled && !loading && (
          <div className="mx-6 my-3 flex items-center gap-2 rounded-md border bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            <PackageCheck className="h-4 w-4 shrink-0" />
            All items in this PO are fully received. Nothing left to receive.
          </div>
        )}

        {!loading && !allItemsFulfilled && (
          <div className="min-h-0 flex-1 overflow-y-auto space-y-1 px-6 py-3">
            {rows.map((row) => {
              const expanded = expandedRows.has(row.key);
              const sumSplit = row.splits.reduce((t, s) => t + (Number(s.qty) || 0), 0);
              const sumValid = sumSplit === Number(row.received_today || 0);
              return (
                <div key={row.key} className="rounded-md border">
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-medium hover:bg-muted/30 transition-colors"
                    onClick={() => toggleExpand(row.key)}
                  >
                    <span className={`shrink-0 transition-transform ${expanded ? "text-accent" : "text-muted-foreground"}`}>
                      {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </span>
                    <span className="flex-1 truncate">{row.item_name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">Ord. {row.ordered_qty.toFixed(2)}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">Rec. {row.received_so_far.toFixed(2)}</span>
                    <span className={`shrink-0 text-xs font-medium ${Number(row.remaining) > 0 ? "text-amber-600" : "text-emerald-600"}`}>
                      Rem. {row.remaining.toFixed(2)}
                    </span>
                  </button>

                  {expanded && (
                    <div className="border-t px-4 py-3 space-y-3 bg-muted/10">
                      <div className="flex flex-wrap items-end gap-3">
                        <div className="w-48">
                          <Label className="text-xs font-medium">Receive Qty</Label>
                          <Input
                            type="number"
                            min={0}
                            max={row.remaining}
                            step="0.0001"
                            className="h-8 text-sm font-mono text-right"
                            value={row.received_today || ""}
                            onChange={(e) => patchRow(row.key, { received_today: Number(e.target.value || 0) })}
                          />
                        </div>
                        <div className="w-36 text-xs text-muted-foreground pb-1.5">
                          <span className="font-medium text-foreground">
                            {Number(row.unit_cost).toLocaleString("en-PH", { style: "currency", currency: "PHP" })}
                          </span>
                          <span className="block">/ {row.uom || "unit"}</span>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-muted-foreground">Assignments</span>
                          <span className={`text-xs ${sumValid ? "text-muted-foreground" : "text-red-500 font-medium"}`}>
                            {sumSplit.toFixed(2)} / {Number(row.received_today || 0).toFixed(2)} assigned
                            {!sumValid && " — mismatch"}
                          </span>
                        </div>
                        <div className="space-y-1">
                          {row.splits.map((split, idx) => {
                            const filteredUsers = users.filter(
                              (u) => Number(u.user_department ?? -1) === Number(split.department_id)
                            );
                            return (
                              <div key={idx} className="grid grid-cols-[1fr_1fr_100px_28px] gap-2 items-center">
                                <Select
                                  value={String(split.department_id)}
                                  onValueChange={(v) => updateSplit(row.key, idx, { department_id: Number(v) })}
                                >
                                  <SelectTrigger className="w-full h-8 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent className="max-h-[200px] overflow-y-auto">
                                    {departments.map((d) => (
                                      <SelectItem key={d.department_id} value={String(d.department_id)}>{d.department_name}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Select
                                  value={split.user_id != null ? String(split.user_id) : "_none"}
                                  onValueChange={(v) => updateSplit(row.key, idx, { user_id: (v && v !== "_none") ? Number(v) : null })}
                                >
                                  <SelectTrigger className="w-full h-8 text-xs">
                                    <SelectValue placeholder="Unassigned" />
                                  </SelectTrigger>
                                  <SelectContent className="max-h-[200px] overflow-y-auto">
                                    <SelectItem value="_none">Unassigned</SelectItem>
                                    {filteredUsers.map((u) => (
                                      <SelectItem key={u.user_id} value={String(u.user_id)}>{u.full_name}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Input
                                  type="number"
                                  min={0}
                                  max={row.received_today}
                                  step="0.0001"
                                  className="h-8 text-xs font-mono text-right"
                                  value={split.qty || ""}
                                  onChange={(e) => {
                                    const value = Number(e.target.value || 0);
                                    updateSplit(row.key, idx, { qty: Math.max(0, Math.min(row.received_today, value)) });
                                  }}
                                />
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeSplit(row.key, idx)}>
                                  <X className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => addSplit(row.key)}>
                          <Plus className="h-3 w-3 mr-1" /> Add Split
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {!loading && !allItemsFulfilled && rows.length > 0 && (
          <div className="flex items-center justify-between border-t px-6 py-2.5 text-xs text-muted-foreground bg-muted/10">
            <span>{rows.filter((r) => r.received_today > 0).length} of {rows.length} item(s) being received</span>
            <span className="font-medium text-foreground">
              Total: {rows.reduce((s, r) => s + (Number(r.received_today) || 0), 0).toFixed(2)} qty
            </span>
          </div>
        )}

        <DialogFooter className="px-6 py-3 border-t">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button size="sm" onClick={handleSave} disabled={!valid || !hasWork || saving || allItemsFulfilled}>
            {saving ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Saving…</> : "Save Receiving"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
