"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useVariants } from "../hooks/useItemVariants";
import { ItemVariantFilters } from "./ItemVariantFilters";
import { ItemVariantTable } from "./ItemVariantTable";

export default function ItemVariantListPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const handleSearchChange = useCallback((val: string) => {
    setSearch(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(val), 300);
  }, []);

  const { data, loading, error } = useVariants({ search: debouncedSearch || undefined });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Item Variants</h1>
        <Button onClick={() => router.push("/fm/procurement/items/variants/create")}>
          <Plus className="mr-2 h-4 w-4" />
          Add Variant
        </Button>
      </div>
      <ItemVariantFilters search={search} onSearchChange={handleSearchChange} />
      <ItemVariantTable data={data} loading={loading} error={error} />
    </div>
  );
}
