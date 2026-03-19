"use client";

import * as React from "react";
import { toast } from "sonner";

import type { DeliveryTermRow, DeliveryTermPayload } from "../types";
import * as api from "../providers/fetchProvider";

type EditState =
  | { open: false; row: null }
  | { open: true; row: DeliveryTermRow };

export function useDeliveryTerms() {
  const [q, setQ] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [pageSize] = React.useState(20);

  const [rows, setRows] = React.useState<DeliveryTermRow[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);

  const [createOpen, setCreateOpen] = React.useState(false);
  const [editState, setEditState] = React.useState<EditState>({ open: false, row: null });

  const load = React.useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.listDeliveryTerms({ q, page, pageSize });
      setRows(res.data ?? []);
      const t = res?.meta?.filter_count ?? res?.meta?.total_count ?? 0;
      setTotal(typeof t === "number" ? t : 0);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to load delivery terms");
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [q, page, pageSize]);

  React.useEffect(() => {
    load();
  }, [load]);

  function openCreate() {
    setCreateOpen(true);
  }

  function openEdit(row: DeliveryTermRow) {
    setEditState({ open: true, row });
  }

  function closeEdit() {
    setEditState({ open: false, row: null });
  }

  async function create(payload: DeliveryTermPayload) {
    try {
      console.log("📤 useDeliveryTerms.create - Sending payload:", payload);
      await api.createDeliveryTerm(payload);
      console.log("✅ useDeliveryTerms.create - Success");
      toast.success("Delivery term created");
      setCreateOpen(false);
      setPage(1);
      await load();
    } catch (e: unknown) {
      console.error("❌ useDeliveryTerms.create - Error:", e);
      toast.error(e instanceof Error ? e.message : "Create failed");
    }
  }

  async function update(id: number, payload: Partial<DeliveryTermPayload>) {
    try {
      console.log("📤 useDeliveryTerms.update - Sending id:", id, "payload:", payload);
      await api.updateDeliveryTerm(id, payload);
      console.log("✅ useDeliveryTerms.update - Success");
      toast.success("Changes saved");
      closeEdit();
      await load();
    } catch (e: unknown) {
      console.error("❌ useDeliveryTerms.update - Error:", e);
      toast.error(e instanceof Error ? e.message : "Update failed");
    }
  }

  async function remove(id: number) {
    try {
      await api.deleteDeliveryTerm(id);
      toast.success("Delivery term deleted");
      // If last item on page, go back a page (basic)
      const after = Math.max(0, total - 1);
      const maxPage = Math.max(1, Math.ceil(after / pageSize));
      if (page > maxPage) setPage(maxPage);
      else await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  }

  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const canPrev = page > 1;
  const canNext = page < pageCount;

  return {
    // list
    rows,
    total,
    loading,

    // search/paging
    q,
    setQ,
    page,
    setPage,
    pageSize,
    pageCount,
    canPrev,
    canNext,

    // dialogs
    createOpen,
    setCreateOpen,
    editState,
    openCreate,
    openEdit,
    closeEdit,

    // actions
    create,
    update,
    remove,
  };
}
