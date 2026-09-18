"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useItems } from "@/modules/financial-management/procurement/items/hooks/useItems";
import { deleteVariant, listVariants } from "@/modules/financial-management/procurement/items/providers/itemService";
import type { ItemVariant } from "@/modules/financial-management/procurement/items/utils/types";
import { ItemFilters, type ItemStatusFilter } from "@/modules/financial-management/procurement/items/components/ItemFilters";
import { ItemTable } from "@/modules/financial-management/procurement/items/components/ItemTable";
import { ItemCreateModal } from "@/modules/financial-management/procurement/items/components/ItemCreateModal";
import { ItemEditModal } from "@/modules/financial-management/procurement/items/components/ItemEditModal";
import { ItemVariantModal } from "@/modules/financial-management/procurement/items/components/ItemVariantModal";

interface VariantModalState {
  mode: "create" | "edit" | "clone";
  itemId?: number;
  variantId?: number;
  cloneVariantId?: number;
}

const PAGE_SIZE = 10;

export default function ItemListPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ItemStatusFilter>("all");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [variantModal, setVariantModal] = useState<VariantModalState | null>(null);
  const [variants, setVariants] = useState<Record<number, ItemVariant[]>>({});
  const [deletingVariantId, setDeletingVariantId] = useState<number | null>(null);

  const { data, loading, error, total, reload } = useItems({
    search: search || undefined,
    page,
    limit: PAGE_SIZE,
    activeOnly: statusFilter === "active" ? true : undefined,
  });

  // The templates BFF exposes only active_only=true, so Inactive is filtered
  // client-side from the fetched page (no API shape change per scope).
  const visibleItems = statusFilter === "inactive" ? data.filter((t) => !t.is_active) : data;

  const handleSearchChange = useCallback((v: string) => {
    setSearch(v);
    setPage(1);
  }, []);

  const handleStatusChange = useCallback((v: ItemStatusFilter) => {
    setStatusFilter(v);
    setPage(1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    listVariants({ limit: 300 })
      .then((res) => {
        if (cancelled) return;
        const grouped: Record<number, ItemVariant[]> = {};
        for (const v of res.data || []) {
          const tmplId = v.item_tmpl_id;
          if (!grouped[tmplId]) grouped[tmplId] = [];
          grouped[tmplId].push(v);
        }
        setVariants(grouped);
      })
      .catch((err) => {
        if (!cancelled) console.error("[ItemListPage] loadVariants", err);
      });
    return () => {
      cancelled = true;
    };
  }, [data]);

  const handleSaved = useCallback(() => {
    reload();
  }, [reload]);

  const handleDeleteVariant = useCallback(async (variant: ItemVariant) => {
    const siblings = variants[variant.item_tmpl_id] ?? [];
    if (siblings.length <= 1) {
      toast.error("Each item needs at least one variant");
      return;
    }
    if (!window.confirm(`Delete variant "${variant.name}"?`)) return;
    setDeletingVariantId(variant.id);
    try {
      await deleteVariant(variant.id);
      toast.success("Variant deleted");
      setVariants((prev) => ({
        ...prev,
        [variant.item_tmpl_id]: (prev[variant.item_tmpl_id] ?? []).filter((v) => v.id !== variant.id),
      }));
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete variant");
    } finally {
      setDeletingVariantId(null);
    }
  }, [variants, reload]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Items</h1>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Item
        </Button>
      </div>
      <ItemFilters value={search} onChange={handleSearchChange} status={statusFilter} onStatusChange={handleStatusChange} />
      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}
      <ItemTable
        items={visibleItems}
        variants={variants}
        onEdit={setEditId}
        onEditVariant={(variantId) => setVariantModal({ mode: "edit", variantId })}
        onAddVariant={(itemId) => setVariantModal({ mode: "create", itemId })}
        onCloneVariant={(variant) =>
          setVariantModal({ mode: "clone", itemId: variant.item_tmpl_id, cloneVariantId: variant.id })
        }
        onDeleteVariant={handleDeleteVariant}
        deletingVariantId={deletingVariantId}
        loading={loading}
        total={total}
        page={page}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
      />
      <ItemCreateModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSaved={handleSaved}
      />
      {editId !== null && (
        <ItemEditModal
          key={editId}
          id={editId}
          open={editId !== null}
          onOpenChange={(o) => {
            if (!o) setEditId(null);
          }}
          onSaved={handleSaved}
        />
      )}
      {variantModal !== null && (
        <ItemVariantModal
          key={
            variantModal.mode === "edit"
              ? `edit-${variantModal.variantId}`
              : variantModal.mode === "clone"
                ? `clone-${variantModal.cloneVariantId}`
                : `create-${variantModal.itemId}`
          }
          itemId={variantModal.itemId}
          variantId={variantModal.variantId}
          cloneVariantId={variantModal.cloneVariantId}
          open={variantModal !== null}
          onOpenChange={(o) => {
            if (!o) setVariantModal(null);
          }}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
