"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useTemplates } from "../hooks/useItemTemplates";
import { ItemTemplateFilters } from "./ItemTemplateFilters";
import { ItemTemplateTable } from "./ItemTemplateTable";

export default function ItemTemplateListPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const handleSearchChange = useCallback((val: string) => {
    setSearch(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(val), 300);
  }, []);

  const { data, loading, error } = useTemplates({ search: debouncedSearch || undefined });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Item Templates</h1>
        <Button onClick={() => router.push("/fm/procurement/items/templates/create")}>
          <Plus className="mr-2 h-4 w-4" />
          Add Template
        </Button>
      </div>
      <ItemTemplateFilters search={search} onSearchChange={handleSearchChange} />
      <ItemTemplateTable data={data} loading={loading} error={error} />
    </div>
  );
}
