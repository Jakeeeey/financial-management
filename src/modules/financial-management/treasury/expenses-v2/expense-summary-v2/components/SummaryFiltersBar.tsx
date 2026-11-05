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
  SummaryFilterState,
  DivisionInfo,
  DepartmentOption,
  ChartOfAccountOption,
} from "../types";
import { Search, RotateCcw, ChevronDown } from "lucide-react";

interface SummaryFiltersBarProps {
  filters: SummaryFilterState;
  divisions: DivisionInfo[];
  departments?: DepartmentOption[];
  coas: ChartOfAccountOption[];
  encoders?: { user_id: number; user_fname: string; user_lname: string; user_email?: string; division_id?: number | null }[];
  isEncoderSelected?: boolean;
  onFilterChange: <K extends keyof SummaryFilterState>(key: K, value: SummaryFilterState[K]) => void;
  onResetFilters: () => void;
}

const STATUS_OPTIONS = [
  { value: "Draft", label: "Draft" },
  { value: "Pending Approval", label: "Pending Approval" },
  { value: "Submitted To Disbursement", label: "Approved" },
  { value: "With Concern", label: "With Concern" },
  { value: "Rejected", label: "Rejected" },
];

export const SummaryFiltersBar: React.FC<SummaryFiltersBarProps> = ({
  filters,
  divisions,
  coas,
  encoders = [],
  isEncoderSelected = false,
  onFilterChange,
  onResetFilters,
}) => {
  const [coaSearch, setCoaSearch] = useState("");
  const [encoderSearch, setEncoderSearch] = useState("");

  // Filter COAs in popover search (Screen 2)
  const filteredCoas = useMemo(() => {
    if (!coaSearch.trim()) return coas;
    const q = coaSearch.toLowerCase();
    return coas.filter(
      (c) =>
        (c.account_title || "").toLowerCase().includes(q) ||
        (c.gl_code || "").toLowerCase().includes(q)
    );
  }, [coas, coaSearch]);

  // Filter Encoders in popover search (Screen 1)
  const filteredEncodersList = useMemo(() => {
    if (!encoderSearch.trim()) return encoders;
    const q = encoderSearch.toLowerCase();
    return encoders.filter((e) => {
      const full = `${e.user_fname} ${e.user_lname}`.toLowerCase();
      const email = (e.user_email || "").toLowerCase();
      return full.includes(q) || email.includes(q);
    });
  }, [encoders, encoderSearch]);

  const isAllStatusesSelected =
    !filters.statuses ||
    filters.statuses.length === 0 ||
    filters.statuses.length === STATUS_OPTIONS.length;

  const isAllCoasSelected =
    !filters.coaIds ||
    filters.coaIds.length === 0 ||
    filters.coaIds.length === coas.length;

  const isAllDivisionsSelected =
    !filters.divisionIds ||
    filters.divisionIds.length === 0 ||
    filters.divisionIds.length === divisions.length;

  const isAllEncodersSelected =
    !filters.encoderIds ||
    filters.encoderIds.length === 0 ||
    filters.encoderIds.length === encoders.length;

  // Status Trigger Label
  const getStatusTriggerLabel = () => {
    if (isAllStatusesSelected) {
      return "All Statuses";
    }
    if (filters.statuses.length === 1) {
      const match = STATUS_OPTIONS.find((s) => s.value === filters.statuses[0]);
      return match ? match.label : filters.statuses[0];
    }
    return `${filters.statuses.length} Statuses`;
  };

  // COA Trigger Label
  const getCoaTriggerLabel = () => {
    if (isAllCoasSelected) {
      return "All COAs";
    }
    if (filters.coaIds.length === 1) {
      const found = coas.find((c) => c.coa_id === filters.coaIds[0]);
      return found ? found.account_title : "1 COA";
    }
    return `${filters.coaIds.length} COAs`;
  };

  // Division Multi-Select Trigger Label
  const getDivisionTriggerLabel = () => {
    if (isAllDivisionsSelected) {
      return "All Divisions";
    }
    if (filters.divisionIds.length === 1) {
      const found = divisions.find((d) => d.division_id === filters.divisionIds[0]);
      return found ? found.division_name : "1 Division";
    }
    return `${filters.divisionIds.length} Divisions`;
  };

  // Encoder Multi-Select Trigger Label
  const getEncoderTriggerLabel = () => {
    if (isAllEncodersSelected) {
      return "All Encoders";
    }
    if (filters.encoderIds.length === 1) {
      const found = encoders.find((e) => e.user_id === filters.encoderIds[0]);
      return found ? `${found.user_fname} ${found.user_lname}` : "1 Encoder";
    }
    return `${filters.encoderIds.length} Encoders`;
  };

  // Status toggles
  const handleToggleStatus = (val: string) => {
    if (isAllStatusesSelected) {
      const rest = STATUS_OPTIONS.map((s) => s.value).filter((s) => s !== val);
      onFilterChange("statuses", rest);
      return;
    }

    const current = filters.statuses || [];
    if (current.includes(val)) {
      const next = current.filter((s) => s !== val);
      onFilterChange("statuses", next);
    } else {
      const next = [...current, val];
      if (next.length === STATUS_OPTIONS.length) {
        onFilterChange("statuses", []);
      } else {
        onFilterChange("statuses", next);
      }
    }
  };

  const handleSelectAllStatuses = () => {
    onFilterChange("statuses", []);
  };

  const handleClearStatuses = () => {
    onFilterChange("statuses", ["__NONE__"]);
  };

  // COA toggles
  const handleToggleCoa = (id: number) => {
    if (isAllCoasSelected) {
      const rest = coas.map((c) => c.coa_id).filter((c) => c !== id);
      onFilterChange("coaIds", rest);
      return;
    }

    const current = filters.coaIds || [];
    if (current.includes(id)) {
      const next = current.filter((c) => c !== id);
      onFilterChange("coaIds", next);
    } else {
      const next = [...current, id];
      if (next.length === coas.length) {
        onFilterChange("coaIds", []);
      } else {
        onFilterChange("coaIds", next);
      }
    }
  };

  const handleSelectAllCoas = () => {
    onFilterChange("coaIds", []);
  };

  const handleClearCoas = () => {
    onFilterChange("coaIds", [-1]);
  };

  // Division Multi-Select toggles
  const handleToggleDivision = (id: number) => {
    if (isAllDivisionsSelected) {
      const rest = divisions.map((d) => d.division_id).filter((d) => d !== id);
      onFilterChange("divisionIds", rest);
      return;
    }

    const current = filters.divisionIds || [];
    if (current.includes(id)) {
      const next = current.filter((d) => d !== id);
      onFilterChange("divisionIds", next);
    } else {
      const next = [...current, id];
      if (next.length === divisions.length) {
        onFilterChange("divisionIds", []);
      } else {
        onFilterChange("divisionIds", next);
      }
    }
  };

  const handleSelectAllDivisions = () => {
    onFilterChange("divisionIds", []);
  };

  const handleClearDivisions = () => {
    onFilterChange("divisionIds", [-1]);
  };

  // Encoder Multi-Select toggles
  const handleToggleEncoder = (id: number) => {
    if (isAllEncodersSelected) {
      const rest = encoders.map((e) => e.user_id).filter((e) => e !== id);
      onFilterChange("encoderIds", rest);
      return;
    }

    const current = filters.encoderIds || [];
    if (current.includes(id)) {
      const next = current.filter((e) => e !== id);
      onFilterChange("encoderIds", next);
    } else {
      const next = [...current, id];
      if (next.length === encoders.length) {
        onFilterChange("encoderIds", []);
      } else {
        onFilterChange("encoderIds", next);
      }
    }
  };

  const handleSelectAllEncoders = () => {
    onFilterChange("encoderIds", []);
  };

  const handleClearEncoders = () => {
    onFilterChange("encoderIds", [-1]);
  };

  return (
    <div className="bg-card border border-border dark:border-zinc-700/80 dark:bg-zinc-900/80 p-3 rounded-xl shadow-xs">
      <div className={`flex flex-col md:flex-row md:items-center gap-2.5 ${isEncoderSelected ? "justify-between" : "justify-end"}`}>
        {/* Screen 2 Only: Search Field */}
        {isEncoderSelected && (
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search doc code, payee, COA, remarks..."
              value={filters.search}
              onChange={(e) => onFilterChange("search", e.target.value)}
              className="pl-8.5 bg-background border border-border dark:border-zinc-700/80 text-xs h-8.5"
            />
          </div>
        )}

        {/* Filter Controls Group */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* ================= SCREEN 1 FILTERS (PAGE 1) ================= */}
          {!isEncoderSelected && (
            <>
              {/* 1. Multi-Select Divisions Popover */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8.5 text-xs bg-background border border-border dark:border-zinc-700/80 justify-between min-w-[145px] px-2.5 font-normal"
                  >
                    <span className="truncate">{getDivisionTriggerLabel()}</span>
                    <ChevronDown className="w-3.5 h-3.5 opacity-50 shrink-0 ml-1" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-64 p-2 z-[100] bg-popover text-popover-foreground border border-border shadow-md">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-border/60 px-1">
                    <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                      Divisions ({isAllDivisionsSelected ? divisions.length : (filters.divisionIds?.includes(-1) ? 0 : filters.divisionIds?.length || 0)}/{divisions.length})
                    </span>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleSelectAllDivisions}
                        className="h-6 text-[10px] px-1.5 font-semibold text-primary hover:bg-primary/10"
                      >
                        Select All
                      </Button>
                      <span className="text-muted-foreground/40 text-xs">•</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleClearDivisions}
                        className="h-6 text-[10px] px-1.5 font-semibold text-rose-500 hover:bg-rose-500/10"
                      >
                        Clear
                      </Button>
                    </div>
                  </div>

                  {/* Divisions Checkbox List */}
                  <div className="max-h-60 overflow-y-auto space-y-1 pr-1">
                    {divisions.map((d) => {
                      const isChecked = isAllDivisionsSelected || (filters.divisionIds?.includes(d.division_id) ?? false);
                      return (
                        <div
                          key={d.division_id}
                          onClick={() => handleToggleDivision(d.division_id)}
                          className="flex items-center space-x-2.5 p-1.5 rounded-md hover:bg-muted/60 cursor-pointer text-xs transition-colors"
                        >
                          <Checkbox
                            id={`div-${d.division_id}`}
                            checked={isChecked}
                            onCheckedChange={() => handleToggleDivision(d.division_id)}
                          />
                          <label
                            htmlFor={`div-${d.division_id}`}
                            className="text-xs font-medium cursor-pointer leading-none flex-1 truncate"
                          >
                            {d.division_name}
                          </label>
                        </div>
                      );
                    })}
                  </div>
                </PopoverContent>
              </Popover>

              {/* 2. Multi-Select Searchable Encoders Popover (AFTER Division Filter) */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8.5 text-xs bg-background border border-border dark:border-zinc-700/80 justify-between min-w-[145px] px-2.5 font-normal"
                  >
                    <span className="truncate">{getEncoderTriggerLabel()}</span>
                    <ChevronDown className="w-3.5 h-3.5 opacity-50 shrink-0 ml-1" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-72 p-2 z-[100] bg-popover text-popover-foreground border border-border shadow-md">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-border/60 px-1">
                    <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                      Encoders ({isAllEncodersSelected ? encoders.length : (filters.encoderIds?.includes(-1) ? 0 : filters.encoderIds?.length || 0)}/{encoders.length})
                    </span>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleSelectAllEncoders}
                        className="h-6 text-[10px] px-1.5 font-semibold text-primary hover:bg-primary/10"
                      >
                        Select All
                      </Button>
                      <span className="text-muted-foreground/40 text-xs">•</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleClearEncoders}
                        className="h-6 text-[10px] px-1.5 font-semibold text-rose-500 hover:bg-rose-500/10"
                      >
                        Clear
                      </Button>
                    </div>
                  </div>

                  {/* Live Search inside Encoders Popover */}
                  <div className="relative mb-2">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Search encoder name..."
                      value={encoderSearch}
                      onChange={(e) => setEncoderSearch(e.target.value)}
                      className="pl-8 bg-background border border-border dark:border-zinc-700/80 text-xs h-7.5"
                    />
                  </div>

                  {/* Encoders Checkbox List */}
                  <div className="max-h-60 overflow-y-auto space-y-1 pr-1">
                    {filteredEncodersList.length === 0 ? (
                      <div className="p-3 text-center text-xs text-muted-foreground italic">
                        No encoders found.
                      </div>
                    ) : (
                      filteredEncodersList.map((e) => {
                        const isChecked = isAllEncodersSelected || (filters.encoderIds?.includes(e.user_id) ?? false);
                        const fullName = `${e.user_fname} ${e.user_lname}`;
                        return (
                          <div
                            key={e.user_id}
                            onClick={() => handleToggleEncoder(e.user_id)}
                            className="flex items-center space-x-2.5 p-1.5 rounded-md hover:bg-muted/60 cursor-pointer text-xs transition-colors"
                          >
                            <Checkbox
                              id={`encoder-${e.user_id}`}
                              checked={isChecked}
                              onCheckedChange={() => handleToggleEncoder(e.user_id)}
                            />
                            <div className="min-w-0 flex-1">
                              <label
                                htmlFor={`encoder-${e.user_id}`}
                                className="text-xs font-medium cursor-pointer leading-none block truncate"
                              >
                                {fullName}
                              </label>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            </>
          )}

          {/* ================= SCREEN 2 FILTERS (PAGE 2 DETAIL VIEW) ================= */}
          {isEncoderSelected && (
            <>
              <div className="w-[138px]">
                <Input
                  type="date"
                  title="Date From"
                  value={filters.dateFrom}
                  onChange={(e) => onFilterChange("dateFrom", e.target.value)}
                  className="bg-background border border-border dark:border-zinc-700/80 text-xs h-8.5 px-2.5"
                />
              </div>

              <div className="w-[138px]">
                <Input
                  type="date"
                  title="Date To"
                  value={filters.dateTo}
                  onChange={(e) => onFilterChange("dateTo", e.target.value)}
                  className="bg-background border border-border dark:border-zinc-700/80 text-xs h-8.5 px-2.5"
                />
              </div>

              {/* Multi-Select Status Popover */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8.5 text-xs bg-background border border-border dark:border-zinc-700/80 justify-between w-[138px] px-2.5 font-normal"
                  >
                    <span className="truncate">{getStatusTriggerLabel()}</span>
                    <ChevronDown className="w-3.5 h-3.5 opacity-50 shrink-0 ml-1" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-56 p-2 z-[100] bg-popover text-popover-foreground border border-border shadow-md">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-border/60 px-1">
                    <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                      Statuses ({isAllStatusesSelected ? STATUS_OPTIONS.length : (filters.statuses?.includes("__NONE__") ? 0 : filters.statuses?.length || 0)}/{STATUS_OPTIONS.length})
                    </span>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleSelectAllStatuses}
                        className="h-6 text-[10px] px-1.5 font-semibold text-primary hover:bg-primary/10"
                      >
                        Select All
                      </Button>
                      <span className="text-muted-foreground/40 text-xs">•</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleClearStatuses}
                        className="h-6 text-[10px] px-1.5 font-semibold text-rose-500 hover:bg-rose-500/10"
                      >
                        Clear
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    {STATUS_OPTIONS.map((opt) => {
                      const isChecked = isAllStatusesSelected || (filters.statuses?.includes(opt.value) ?? false);
                      return (
                        <div
                          key={opt.value}
                          onClick={() => handleToggleStatus(opt.value)}
                          className="flex items-center space-x-2.5 p-1.5 rounded-md hover:bg-muted/60 cursor-pointer text-xs transition-colors"
                        >
                          <Checkbox
                            id={`status-${opt.value}`}
                            checked={isChecked}
                            onCheckedChange={() => handleToggleStatus(opt.value)}
                          />
                          <label
                            htmlFor={`status-${opt.value}`}
                            className="text-xs font-medium cursor-pointer leading-none flex-1"
                          >
                            {opt.label}
                          </label>
                        </div>
                      );
                    })}
                  </div>
                </PopoverContent>
              </Popover>

              {/* Multi-Select Searchable Chart of Accounts Popover */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8.5 text-xs bg-background border border-border dark:border-zinc-700/80 justify-between w-[138px] px-2.5 font-normal"
                  >
                    <span className="truncate">{getCoaTriggerLabel()}</span>
                    <ChevronDown className="w-3.5 h-3.5 opacity-50 shrink-0 ml-1" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-72 p-2 z-[100] bg-popover text-popover-foreground border border-border shadow-md">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-border/60 px-1">
                    <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                      COA ({isAllCoasSelected ? coas.length : (filters.coaIds?.includes(-1) ? 0 : filters.coaIds?.length || 0)}/{coas.length})
                    </span>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleSelectAllCoas}
                        className="h-6 text-[10px] px-1.5 font-semibold text-primary hover:bg-primary/10"
                      >
                        Select All
                      </Button>
                      <span className="text-muted-foreground/40 text-xs">•</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleClearCoas}
                        className="h-6 text-[10px] px-1.5 font-semibold text-rose-500 hover:bg-rose-500/10"
                      >
                        Clear
                      </Button>
                    </div>
                  </div>

                  <div className="relative mb-2">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Search code or title..."
                      value={coaSearch}
                      onChange={(e) => setCoaSearch(e.target.value)}
                      className="pl-8 bg-background border border-border dark:border-zinc-700/80 text-xs h-7.5"
                    />
                  </div>

                  <div className="max-h-60 overflow-y-auto space-y-1 pr-1">
                    {filteredCoas.length === 0 ? (
                      <div className="p-3 text-center text-xs text-muted-foreground italic">
                        No accounts found matching search.
                      </div>
                    ) : (
                      filteredCoas.map((c) => {
                        const isChecked = isAllCoasSelected || (filters.coaIds?.includes(c.coa_id) ?? false);
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
                              {c.gl_code ? <span className="font-mono font-bold mr-1">{c.gl_code}</span> : null}
                              <span>{c.account_title}</span>
                            </label>
                          </div>
                        );
                      })
                    )}
                  </div>
                </PopoverContent>
              </Popover>

              {/* Reset Action Button on Screen 2 */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setCoaSearch("");
                  onResetFilters();
                }}
                className="h-8.5 text-xs gap-1.5 bg-background border border-border dark:border-zinc-700/80 hover:bg-muted font-semibold px-2.5"
                title="Reset Filters"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Reset Filters
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
