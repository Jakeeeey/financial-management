"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Search, X, Filter } from "lucide-react";
import { AuditTrailFilters as FiltersType, AuditAction } from "../types";

const ACTIONS: AuditAction[] = [
  "Created", "Submitted", "Approved", "Rejected", "Resubmitted", "Supplement Requested", "Deleted"
];

export function AuditTrailFilters({ 
  filters, 
  updateFilter, 
  clearFilters 
}: { 
  filters: FiltersType; 
  updateFilter: (k: keyof FiltersType, v: string) => void;
  clearFilters: () => void;
}) {
  return (
    <div className="flex flex-col gap-4 p-5 rounded-2xl border border-border/50 bg-card shadow-sm">
      <div className="flex flex-col md:flex-row gap-4 items-end">
        <div className="flex-1 space-y-1.5">
          <label className="text-[10px] font-black uppercase text-muted-foreground ml-1 tracking-widest">Search Logs</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input 
              placeholder="Search by COA, GL Code, User, or Remarks..." 
              value={filters.search}
              onChange={(e) => updateFilter("search", e.target.value)}
              className="pl-9 h-10 rounded-xl bg-muted/30 border-border/50 text-xs"
            />
          </div>
        </div>

        <div className="w-full md:w-48 space-y-1.5">
          <label className="text-[10px] font-black uppercase text-muted-foreground ml-1 tracking-widest">Filter Action</label>
          <Select 
            value={filters.action || "all"} 
            onValueChange={(v) => updateFilter("action", v === "all" ? "" : v)}
          >
            <SelectTrigger className="h-10 rounded-xl bg-muted/30 border-border/50 text-xs font-bold">
              <SelectValue placeholder="All Actions" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all">All Actions</SelectItem>
              {ACTIONS.map(action => (
                <SelectItem key={action} value={action}>{action}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-2 h-10">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={clearFilters}
            className="h-full px-3 text-xs font-bold gap-2 rounded-xl"
          >
            <X className="h-3.5 w-3.5" />
            Clear
          </Button>
          <Button 
            size="sm" 
            className="h-full px-4 text-xs font-black uppercase tracking-tight gap-2 rounded-xl shadow-md active:scale-95 transition-all"
          >
            <Filter className="h-3.5 w-3.5" />
            Advanced
          </Button>
        </div>
      </div>
    </div>
  );
}
