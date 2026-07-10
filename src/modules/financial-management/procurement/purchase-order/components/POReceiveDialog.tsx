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
import { Loader2, Plus, X, AlertCircle } from "lucide-react";
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
            ? {
                ...row,
                splits: [
                  ...row.splits,
                  { department_id: departments[0]?.department_id ?? 0, user_id: null, qty: 0 },
                ],
              }
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
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Receive &amp; Assign Items</DialogTitle>
          <DialogDescription>Record received quantities and assign items to departments or users.</DialogDescription>
        </DialogHeader>

        {error && (
          <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <Label htmlFor="reference-no">Reference No.</Label>
            <Input
              id="reference-no"
              placeholder="DR / SI number"
              value={referenceNo}
              onChange={(e) => setReferenceNo(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="notes">Notes</Label>
            <Input
              id="notes"
              placeholder="Remarks"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {allItemsFulfilled && !loading && (
          <div className="rounded-md border bg-muted/30 p-4 text-sm text-muted-foreground">
            All items in this PO are fully received. Nothing left to receive.
          </div>
        )}

        {!loading &&
          rows.map((row) => (
            <div key={row.key} className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="font-medium">
                  {row.item_name}{" "}
                  <span className="text-xs text-muted-foreground">• {row.uom}</span>
                </div>
                <div className="flex gap-3 text-xs text-muted-foreground">
                  <span>Ordered: <strong>{row.ordered_qty}</strong></span>
                  <span>Received: <strong>{row.received_so_far}</strong></span>
                  <span>Remaining: <strong>{row.remaining}</strong></span>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                <div>
                  <Label>Qty Received</Label>
                  <Input
                    type="number"
                    min={0}
                    max={row.remaining}
                    step="0.0001"
                    value={row.received_today}
                    onChange={(e) => patchRow(row.key, { received_today: Number(e.target.value || 0) })}
                  />
                </div>
                <div>
                  <Label>Unit Cost</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={row.unit_cost}
                    onChange={(e) => patchRow(row.key, { unit_cost: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <Label>Currency</Label>
                  <Input
                    value={row.currency}
                    onChange={(e) => patchRow(row.key, { currency: e.target.value })}
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => addSplit(row.key)}
                    disabled={row.remaining <= 0}
                  >
                    <Plus className="h-4 w-4 mr-1" /> Add Split
                  </Button>
                </div>
              </div>

              {row.splits.map((split, idx) => {
                const filteredUsers = users.filter(
                  (u) => Number(u.user_department ?? -1) === Number(split.department_id)
                );
                return (
                  <div key={idx} className="grid grid-cols-1 gap-3 sm:grid-cols-4 items-end rounded-md bg-muted/20 p-3">
                    <div>
                      <Label>Department</Label>
                      <Select
                        value={String(split.department_id)}
                        onValueChange={(v) => updateSplit(row.key, idx, { department_id: Number(v) })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {departments.map((d) => (
                            <SelectItem key={d.department_id} value={String(d.department_id)}>
                              {d.department_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>User (optional)</Label>
                      <Select
                        value={split.user_id != null ? String(split.user_id) : "_none"}
                        onValueChange={(v) => updateSplit(row.key, idx, { user_id: (v && v !== "_none") ? Number(v) : null })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Unassigned" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_none">Unassigned</SelectItem>
                          {filteredUsers.map((u) => (
                            <SelectItem key={u.user_id} value={String(u.user_id)}>
                              {u.full_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Qty</Label>
                      <Input
                        type="number"
                        min={0}
                        max={row.received_today}
                        step="0.0001"
                        value={split.qty}
                        onChange={(e) => {
                          const value = Number(e.target.value || 0);
                          updateSplit(row.key, idx, { qty: Math.max(0, Math.min(row.received_today, value)) });
                        }}
                      />
                    </div>
                    <div className="flex items-end">
                      <Button variant="ghost" size="sm" onClick={() => removeSplit(row.key, idx)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}

              {row.splits.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Sum of splits must equal Qty Received ({row.received_today}).
                </p>
              )}
            </div>
          ))}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!valid || !hasWork || saving || allItemsFulfilled}
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-1 animate-spin" /> Saving…
              </>
            ) : (
              "Save Receiving"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
