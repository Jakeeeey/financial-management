"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useItems } from "@/modules/financial-management/procurement/items/hooks/useItems";
import { listVariants } from "@/modules/financial-management/procurement/items/providers/itemService";
import type { ItemVariant } from "@/modules/financial-management/procurement/items/utils/types";
import { ItemFilters } from "@/modules/financial-management/procurement/items/components/ItemFilters";
import { ItemTable } from "@/modules/financial-management/procurement/items/components/ItemTable";
import { ItemCreateModal } from "@/modules/financial-management/procurement/items/components/ItemCreateModal";
import { ItemEditModal } from "@/modules/financial-management/procurement/items/components/ItemEditModal";
import { ItemVariantModal } from "@/modules/financial-management/procurement/items/components/ItemVariantModal";

interface VariantModalState {
  mode: "create" | "edit";
  itemId?: number;
  variantId?: number;
}

export default function ItemListPage() {
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [variantModal, setVariantModal] = useState<VariantModalState | null>(null);
  const [variants, setVariants] = useState<Record<number, ItemVariant[]>>({});

  const { data, loading, error, reload } = useItems({ search: search || undefined });

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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Items</h1>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Item
        </Button>
      </div>
      <ItemFilters value={search} onChange={setSearch} />
      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}
      <ItemTable
        items={data}
        variants={variants}
        onEdit={setEditId}
        onEditVariant={(variantId) => setVariantModal({ mode: "edit", variantId })}
        onAddVariant={(itemId) => setVariantModal({ mode: "create", itemId })}
        loading={loading}
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
          key={variantModal.mode === "edit" ? `edit-${variantModal.variantId}` : `create-${variantModal.itemId}`}
          itemId={variantModal.itemId}
          variantId={variantModal.variantId}
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
