"use client";

import { useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useTemplates } from "../hooks/useItemTemplates";
import { ItemTemplateFilters } from "./ItemTemplateFilters";
import { ItemTemplateTable } from "./ItemTemplateTable";
import { ItemTemplateEditModal } from "./ItemTemplateEditModal";
import { ItemTemplateCreateModal } from "./ItemTemplateCreateModal";

export default function ItemTemplateListPage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const handleSearchChange = useCallback((val: string) => {
    setSearch(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(val), 300);
  }, []);

  const { data, loading, error, reload } = useTemplates({ search: debouncedSearch || undefined });

  const handleEdit = useCallback((id: number) => {
    setEditId(id);
    setEditOpen(true);
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Item Templates</h1>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Template
        </Button>
      </div>
      <ItemTemplateFilters search={search} onSearchChange={handleSearchChange} />
      <ItemTemplateTable data={data} loading={loading} error={error} onEdit={handleEdit} />
      <ItemTemplateEditModal
        id={editId}
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open);
          if (!open) setEditId(null);
        }}
        onSaved={reload}
      />
      <ItemTemplateCreateModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSaved={reload}
      />
    </div>
  );
}
