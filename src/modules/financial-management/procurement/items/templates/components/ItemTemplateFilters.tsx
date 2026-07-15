"use client";

import { Input } from "@/components/ui/input";

interface ItemTemplateFiltersProps {
  search: string;
  onSearchChange: (val: string) => void;
}

export function ItemTemplateFilters({ search, onSearchChange }: ItemTemplateFiltersProps) {
  return (
    <div className="flex flex-col lg:flex-row items-end gap-3">
      <div className="w-full sm:w-72">
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Search</label>
        <Input
          placeholder="Search by name or description..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-9 w-full"
        />
      </div>
    </div>
  );
}
