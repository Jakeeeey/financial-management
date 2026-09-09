"use client";

import { useEffect, useState } from "react";

import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type ItemStatusFilter = "all" | "active" | "inactive";

interface ItemFiltersProps {
  value: string;
  onChange: (v: string) => void;
  status: ItemStatusFilter;
  onStatusChange: (v: ItemStatusFilter) => void;
  placeholder?: string;
}

export function ItemFilters({ value, onChange, status, onStatusChange, placeholder = "Search items..." }: ItemFiltersProps) {
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
      <div className="w-full sm:w-44">
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Status</label>
        <Select value={status} onValueChange={(v) => onStatusChange(v as ItemStatusFilter)}>
          <SelectTrigger className="h-9 w-full">
            <SelectValue placeholder="All" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
