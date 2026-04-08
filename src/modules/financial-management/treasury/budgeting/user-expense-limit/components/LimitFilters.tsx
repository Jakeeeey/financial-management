"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { X, Search } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import type { LimitFilters as FiltersType, Department } from "../types";

interface LimitFiltersProps {
  filters:      FiltersType;
  departments:  Department[];
  hasFilters:   boolean;
  onChange:     <K extends keyof FiltersType>(key: K, value: FiltersType[K]) => void;
  onClear:      () => void;
}

export function LimitFilters({
  filters, departments, hasFilters, onChange, onClear,
}: LimitFiltersProps) {
  const [searchInput, setSearchInput] = useState(filters.search ?? "");
  const onChangeRef = useRef(onChange);
  const isFirstRender = useRef(true);

  // Keep ref current without triggering effects
  useEffect(() => { onChangeRef.current = onChange; });

  // Sync local state if filters.search is cleared externally (e.g. onClear)
  useEffect(() => {
    setSearchInput(filters.search ?? "");
  }, [filters.search]);

  // Debounce: only call onChange 400ms after the user stops typing,
  // and skip the very first render so we don't fire on mount
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const timer = setTimeout(() => {
      onChangeRef.current("search", searchInput);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]); // only re-run when the user actually types

  return (
    <div className="flex items-center gap-2 w-full flex-wrap">

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        <Input
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          placeholder="Search name, email…"
          className="h-9 pl-8 w-[220px] text-xs"
        />
      </div>

      {/* Department */}
      <Select
        value={filters.department_id || undefined}
        onValueChange={val => onChange("department_id", val === 'all' ? '' : val)}
      >
        <SelectTrigger className="h-9 w-[180px] text-xs">
          <SelectValue placeholder="All Departments" />
        </SelectTrigger>
        <SelectContent className="max-h-60">
          <SelectItem key="all" value="all" className="text-xs">All Departments</SelectItem>
          {departments.map(d => (
            <SelectItem key={d.department_id} value={String(d.department_id)} className="text-xs">
              {d.department_name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Clear */}
      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          className="h-9 px-2.5 text-xs text-muted-foreground hover:text-foreground gap-1.5"
        >
          <X className="h-3.5 w-3.5" /> Clear
        </Button>
      )}
    </div>
  );
}