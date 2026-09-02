"use client";

import { useEffect, useState } from "react";

import { Input } from "@/components/ui/input";

interface ItemFiltersProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

export function ItemFilters({ value, onChange, placeholder = "Search items..." }: ItemFiltersProps) {
  const [search, setSearch] = useState(value);

  useEffect(() => {
    setSearch(value);
  }, [value]);

  useEffect(() => {
    const timer = setTimeout(() => {
      onChange(search);
    }, 300);

    return () => clearTimeout(timer);
  }, [search, onChange]);

  return (
    <div className="flex flex-col lg:flex-row items-end gap-3">
      <div className="w-full sm:w-72">
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Search</label>
        <Input
          placeholder={placeholder}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 w-full"
        />
      </div>
    </div>
  );
}
