"use client";

import React, { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  InspectorFilterState,
  ChartOfAccountOption,
} from "../types";
import {
  Search,
  RotateCcw,
  ChevronDown,
  User,
  Check,
  Building,
} from "lucide-react";

interface InspectorFiltersBarProps {
  filters: InspectorFilterState;
  encoders: {
    user_id: number;
    user_fname: string;
    user_lname: string;
    user_email?: string;
    division_name?: string;
  }[];
  coas: ChartOfAccountOption[];
  onFilterChange: <K extends keyof InspectorFilterState>(
    key: K,
    value: InspectorFilterState[K]
  ) => void;
  onResetFilters: () => void;
}

export const InspectorFiltersBar: React.FC<InspectorFiltersBarProps> = ({
  filters,
  encoders,
  coas,
  onFilterChange,
  onResetFilters,
}) => {
  const [encoderSearch, setEncoderSearch] = useState("");
  const [coaSearch, setCoaSearch] = useState("");
  const [encoderOpen, setEncoderOpen] = useState(false);

  // Filter encoders for popover search
  const filteredEncoders = useMemo(() => {
    if (!encoderSearch.trim()) return encoders;
    const q = encoderSearch.toLowerCase();
    return encoders.filter((e) => {
      const full = `${e.user_fname} ${e.user_lname}`.toLowerCase();
      const email = (e.user_email || "").toLowerCase();
      const div = (e.division_name || "").toLowerCase();
      return full.includes(q) || email.includes(q) || div.includes(q);
    });
  }, [encoders, encoderSearch]);

  // Filter COAs for popover search
  const filteredCoas = useMemo(() => {
    if (!coaSearch.trim()) return coas;
    const q = coaSearch.toLowerCase();
    return coas.filter(
      (c) =>
        (c.account_title || "").toLowerCase().includes(q) ||
        (c.gl_code || "").toLowerCase().includes(q)
    );
  }, [coas, coaSearch]);

  // Selected Encoder label
  const selectedEncoder = useMemo(() => {
    if (!filters.encoderId) return null;
    return encoders.find((e) => e.user_id === filters.encoderId) || null;
  }, [encoders, filters.encoderId]);

  const isAllCoasSelected =
    !filters.coaIds ||
    filters.coaIds.length === 0 ||
    filters.coaIds.length === coas.length;

  const handleSelectAllCoas = () => {
    onFilterChange("coaIds", []);
  };

  const handleClearCoas = () => {
    onFilterChange("coaIds", [-1]);
  };

  const handleToggleCoa = (id: number) => {
    if (isAllCoasSelected) {
      const rest = coas.map((c) => c.coa_id).filter((c) => c !== id);
      onFilterChange("coaIds", rest);
      return;
    }

    // Clean out sentinel -1 if present
    const current = (filters.coaIds || []).filter((cId) => cId !== -1);
    if (current.includes(id)) {
      const next = current.filter((c) => c !== id);
      // If unchecking the last selected item, transition to explicit cleared state [-1]
      onFilterChange("coaIds", next.length === 0 ? [-1] : next);
    } else {
      const next = [...current, id];
      if (next.length === coas.length) {
        onFilterChange("coaIds", []);
      } else {
        onFilterChange("coaIds", next);
      }
    }
  };

  const getCoaTriggerLabel = () => {
    if (isAllCoasSelected) {
      return "All Accounts (COA)";
    }
    const validCoas = (filters.coaIds || []).filter((id) => id !== -1);
    if (validCoas.length === 0) {
      return "0 Accounts";
    }
    if (validCoas.length === 1) {
      const found = coas.find((c) => c.coa_id === validCoas[0]);
      return found ? found.account_title : "1 COA";
    }
    return `${validCoas.length} COAs Selected`;
  };

  // Quick Date Range Helpers
  const handleSetThisMonth = () => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const lastDay = new Date(year, month, 0).getDate();

    onFilterChange("dateFrom", `${year}-${pad(month)}-01`);
    onFilterChange("dateTo", `${year}-${pad(month)}-${pad(lastDay)}`);
  };

  const handleSetLast30Days = () => {
    const now = new Date();
    const past = new Date();
    past.setDate(now.getDate() - 30);

    const pad = (n: number) => String(n).padStart(2, "0");
    const format = (d: Date) =>
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    onFilterChange("dateFrom", format(past));
    onFilterChange("dateTo", format(now));
  };

  const hasActiveFilters =
    Boolean(filters.search.trim()) ||
    filters.encoderId !== null ||
    (filters.coaIds && filters.coaIds.length > 0) ||
    Boolean(filters.dateFrom) ||
    Boolean(filters.dateTo);

  return (
    <div className="bg-card border border-border dark:border-zinc-700/80 dark:bg-zinc-900/80 p-3 rounded-xl shadow-xs">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5">
        {/* Search Field */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search doc code, payee, remarks..."
            value={filters.search}
            onChange={(e) => onFilterChange("search", e.target.value)}
            className="pl-8.5 bg-background border border-border dark:border-zinc-700/80 text-xs h-8.5"
          />
        </div>

        {/* Filter Controls Group */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* 1. SINGLE-SELECT ENCODER POPOVER */}
          <Popover open={encoderOpen} onOpenChange={setEncoderOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8.5 text-xs bg-background border border-border dark:border-zinc-700/80 justify-between min-w-[155px] max-w-[210px] px-2.5 font-normal cursor-pointer"
              >
                <div className="flex items-center gap-1.5 truncate">
                  <User className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span className="truncate">
                    {selectedEncoder
                      ? `${selectedEncoder.user_fname} ${selectedEncoder.user_lname}`
                      : "Select Encoder"}
                  </span>
                </div>
                <ChevronDown className="w-3.5 h-3.5 opacity-50 shrink-0 ml-1" />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              className="w-72 p-2 z-[100] bg-popover text-popover-foreground border border-border shadow-md"
            >
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-border/60 px-1">
                <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                  Encoders ({encoders.length})
                </span>
                {filters.encoderId && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      onFilterChange("encoderId", null);
                      setEncoderOpen(false);
                    }}
                    className="h-6 text-[10px] px-1.5 font-semibold text-rose-500 hover:bg-rose-500/10 cursor-pointer"
                  >
                    Clear
                  </Button>
                )}
              </div>

              {/* Live Search inside Encoder Popover */}
              <div className="relative mb-2">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search encoder name or division..."
                  value={encoderSearch}
                  onChange={(e) => setEncoderSearch(e.target.value)}
                  className="pl-8 bg-background border border-border dark:border-zinc-700/80 text-xs h-7.5"
                />
              </div>

              {/* Single Select List */}
              <div className="max-h-60 overflow-y-auto space-y-1 pr-1">
                {filteredEncoders.length === 0 ? (
                  <div className="p-3 text-center text-xs text-muted-foreground italic">
                    No encoders found.
                  </div>
                ) : (
                  filteredEncoders.map((encoder) => {
                    const isSelected = filters.encoderId === encoder.user_id;
                    return (
                      <div
                        key={encoder.user_id}
                        onClick={() => {
                          onFilterChange("encoderId", encoder.user_id);
                          setEncoderOpen(false);
                        }}
                        className={`flex items-center justify-between p-2 rounded-md cursor-pointer text-xs transition-colors ${
                          isSelected
                            ? "bg-primary/10 text-primary font-bold"
                            : "hover:bg-muted/60 text-foreground"
                        }`}
                      >
                        <div className="min-w-0 pr-2">
                          <p className="truncate font-semibold">
                            {encoder.user_fname} {encoder.user_lname}
                          </p>
                          {encoder.division_name && (
                            <p className="text-[10px] text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                              <Building className="w-2.5 h-2.5" />
                              {encoder.division_name}
                            </p>
                          )}
                        </div>
                        {isSelected && (
                          <Check className="w-3.5 h-3.5 text-primary shrink-0" />
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </PopoverContent>
          </Popover>

          {/* 2. DATE FROM */}
          <div className="w-[138px]">
            <Input
              type="date"
              title="Date From"
              value={filters.dateFrom}
              onChange={(e) => onFilterChange("dateFrom", e.target.value)}
              className="bg-background border border-border dark:border-zinc-700/80 text-xs h-8.5 px-2.5 cursor-pointer"
            />
          </div>

          {/* 3. DATE TO */}
          <div className="w-[138px]">
            <Input
              type="date"
              title="Date To"
              value={filters.dateTo}
              onChange={(e) => onFilterChange("dateTo", e.target.value)}
              className="bg-background border border-border dark:border-zinc-700/80 text-xs h-8.5 px-2.5 cursor-pointer"
            />
          </div>

          {/* 4. QUICK DATE PRESETS (This Month & Last 30 Days) */}
          <div className="flex items-center gap-1 bg-muted/40 dark:bg-zinc-800/60 p-0.5 rounded-lg border border-border/60 dark:border-zinc-700/60">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleSetThisMonth}
              className="h-7.5 px-2 text-[10px] font-semibold text-muted-foreground hover:text-foreground hover:bg-background/80 cursor-pointer rounded-md"
            >
              This Month
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleSetLast30Days}
              className="h-7.5 px-2 text-[10px] font-semibold text-muted-foreground hover:text-foreground hover:bg-background/80 cursor-pointer rounded-md"
            >
              Last 30 Days
            </Button>
          </div>

          {/* 5. MULTI-SELECT SEARCHABLE CHART OF ACCOUNTS POPOVER */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8.5 text-xs bg-background border border-border dark:border-zinc-700/80 justify-between w-[155px] px-2.5 font-normal cursor-pointer"
              >
                <span className="truncate">{getCoaTriggerLabel()}</span>
                <ChevronDown className="w-3.5 h-3.5 opacity-50 shrink-0 ml-1" />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              className="w-72 p-2 z-[100] bg-popover text-popover-foreground border border-border shadow-md"
            >
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-border/60 px-1">
                <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                  COA ({isAllCoasSelected ? coas.length : (filters.coaIds?.filter((id) => id !== -1).length || 0)}/{coas.length})
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleSelectAllCoas}
                    className="h-6 text-[10px] px-1.5 font-semibold text-primary hover:bg-primary/10 cursor-pointer"
                  >
                    Select All
                  </Button>
                  <span className="text-muted-foreground/40 text-xs">•</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleClearCoas}
                    className="h-6 text-[10px] px-1.5 font-semibold text-rose-500 hover:bg-rose-500/10 cursor-pointer"
                  >
                    Clear
                  </Button>
                </div>
              </div>

              {/* Live Search inside COA Popover */}
              <div className="relative mb-2">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search code or title..."
                  value={coaSearch}
                  onChange={(e) => setCoaSearch(e.target.value)}
                  className="pl-8 bg-background border border-border dark:border-zinc-700/80 text-xs h-7.5"
                />
              </div>

              {/* COA Checkbox List */}
              <div className="max-h-60 overflow-y-auto space-y-1 pr-1">
                {filteredCoas.length === 0 ? (
                  <div className="p-3 text-center text-xs text-muted-foreground italic">
                    No accounts found matching search.
                  </div>
                ) : (
                  filteredCoas.map((c) => {
                    const isChecked =
                      isAllCoasSelected ||
                      (filters.coaIds?.includes(c.coa_id) ?? false);
                    return (
                      <div
                        key={c.coa_id}
                        onClick={() => handleToggleCoa(c.coa_id)}
                        className="flex items-center space-x-2.5 p-1.5 rounded-md hover:bg-muted/60 cursor-pointer text-xs transition-colors"
                      >
                        <Checkbox
                          id={`coa-${c.coa_id}`}
                          checked={isChecked}
                          onCheckedChange={() => handleToggleCoa(c.coa_id)}
                        />
                        <label
                          htmlFor={`coa-${c.coa_id}`}
                          className="text-xs font-medium cursor-pointer leading-none flex-1 truncate"
                          title={`${c.gl_code || ""} - ${c.account_title}`}
                        >
                          {c.gl_code ? (
                            <span className="font-mono font-bold mr-1">
                              {c.gl_code}
                            </span>
                          ) : null}
                          <span>{c.account_title}</span>
                        </label>
                      </div>
                    );
                  })
                )}
              </div>
            </PopoverContent>
          </Popover>

          {/* 6. RESET BUTTON */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onResetFilters}
            disabled={!hasActiveFilters}
            className={`h-8.5 px-2.5 text-xs border-border dark:border-zinc-700/80 cursor-pointer flex items-center gap-1 transition-colors ${
              hasActiveFilters
                ? "text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20"
                : "text-muted-foreground opacity-50 cursor-not-allowed"
            }`}
            title="Reset all filters"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </Button>
        </div>
      </div>
    </div>
  );
};
