"use client";

import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "_all", label: "All Statuses" },
  { value: "open", label: "Open" },
  { value: "partial", label: "Partially Received" },
  { value: "full", label: "Fully Received" },
  { value: "cancelled", label: "Cancelled" },
];

interface POFiltersProps {
  search: string;
  onSearchChange: (val: string) => void;
  status: string;
  onStatusChange: (val: string) => void;
}

export function POFilters({ search, onSearchChange, status, onStatusChange }: POFiltersProps) {
  return (
    <div className="flex flex-col lg:flex-row items-end gap-3">
      <div className="w-full sm:w-72">
        <label className="text-xs font-medium text-muted-foreground mb-1 block">PO No.</label>
        <Input
          placeholder="Search by PO number..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-9 w-full"
        />
      </div>
          <div className="flex items-end gap-2 ml-auto w-full lg:w-auto">
        <div className="w-full lg:w-44 shrink-0">
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Status</label>
          <Select value={status} onValueChange={onStatusChange}>
            <SelectTrigger className="h-9 w-full">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent className="!max-h-[160px] !overflow-y-auto" position="popper">
              {STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
