"use client";

import * as React from "react";
import {
  Search,
  Calendar as CalendarIcon,
  RotateCcw,
  Bookmark,
  Filter,
  CheckCircle2
} from "lucide-react";
import { format } from "date-fns";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { FilterState, PresetRange } from "../types";

interface FilterPanelProps {
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  uniqueSourceModules: string[];
  onReset: () => void;
}

export default function FilterPanel({ filters, setFilters, uniqueSourceModules, onReset }: FilterPanelProps) {
  const [localFilters, setLocalFilters] = React.useState<FilterState>(filters);

  React.useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  const updateFilter = (key: keyof FilterState, value: any) => {
    setLocalFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleApplyFilter = () => {
    setFilters(localFilters);
  };

  return (
    <div className="w-[300px] shrink-0 space-y-6 overflow-y-auto pr-4 border-r">
      <div className="flex items-center gap-2 font-semibold text-base">
        <Filter className="h-4 w-4" />
        Filter Panel
      </div>

      {/* Date Range Section */}
      <div className="space-y-3">
        <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
          Date Range / Period
        </Label>

        <div className="grid grid-cols-2 gap-2">
          <Button
            variant={localFilters.presetRange !== "Custom" ? "default" : "outline"}
            size="sm"
            className="text-sm h-9"
            onClick={() => updateFilter("presetRange", "Monthly")}
          >
            Preset Range
          </Button>
          <Button
            variant={localFilters.presetRange === "Custom" ? "default" : "outline"}
            size="sm"
            className="text-sm h-9"
            onClick={() => updateFilter("presetRange", "Custom")}
          >
            Manual Range
          </Button>
        </div>

        {localFilters.presetRange !== "Custom" ? (
          <div className="space-y-3">
            <Select
              value={localFilters.presetRange}
              onValueChange={(v) => updateFilter("presetRange", v as PresetRange)}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Select period type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Monthly">Monthly</SelectItem>
                <SelectItem value="Quarterly">Quarterly</SelectItem>
                <SelectItem value="Yearly">Yearly</SelectItem>
              </SelectContent>
            </Select>

            <div className="space-y-3 pt-1">
              {localFilters.presetRange === "Monthly" && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-muted-foreground/70 uppercase">Month</Label>
                    <Select
                      value={localFilters.selectedMonth?.toString()}
                      onValueChange={(v) => updateFilter("selectedMonth", parseInt(v))}
                    >
                      <SelectTrigger className="h-9 text-sm bg-background">
                        <SelectValue placeholder="Month" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 12 }).map((_, i) => (
                          <SelectItem key={i} value={i.toString()} className="text-sm">
                            {format(new Date(2000, i, 1), "MMMM")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-muted-foreground/70 uppercase">Year</Label>
                    <Select
                      value={localFilters.selectedYear?.toString()}
                      onValueChange={(v) => updateFilter("selectedYear", parseInt(v))}
                    >
                      <SelectTrigger className="h-9 text-sm bg-background">
                        <SelectValue placeholder="Year" />
                      </SelectTrigger>
                      <SelectContent>
                        {[2024, 2025, 2026, 2027].map((y) => (
                          <SelectItem key={y} value={y.toString()} className="text-sm">{y}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {localFilters.presetRange === "Quarterly" && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-muted-foreground/70 uppercase">Quarter</Label>
                    <Select
                      value={localFilters.selectedQuarter?.toString()}
                      onValueChange={(v) => updateFilter("selectedQuarter", parseInt(v))}
                    >
                      <SelectTrigger className="h-9 text-sm bg-background">
                        <SelectValue placeholder="Quarter" />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4].map((q) => (
                          <SelectItem key={q} value={q.toString()} className="text-sm">Q{q}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-muted-foreground/70 uppercase">Year</Label>
                    <Select
                      value={filters.selectedYear.toString()}
                      onValueChange={(v) => updateFilter("selectedYear", parseInt(v))}
                    >
                      <SelectTrigger className="h-9 text-sm bg-background">
                        <SelectValue placeholder="Year" />
                      </SelectTrigger>
                      <SelectContent>
                        {[2024, 2025, 2026, 2027].map((y) => (
                          <SelectItem key={y} value={y.toString()} className="text-sm">{y}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {localFilters.presetRange === "Yearly" && (
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-muted-foreground/70 uppercase">Reporting Year</Label>
                  <Select
                    value={localFilters.selectedYear?.toString()}
                    onValueChange={(v) => updateFilter("selectedYear", parseInt(v))}
                  >
                    <SelectTrigger className="h-9 text-sm bg-background">
                      <SelectValue placeholder="Year" />
                    </SelectTrigger>
                    <SelectContent>
                      {[2024, 2025, 2026, 2027].map((y) => (
                        <SelectItem key={y} value={y.toString()} className="text-sm">{y}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <p className="text-xs text-primary/70 font-semibold flex items-center gap-1.5 mt-1 px-1">
                <CalendarIcon className="h-3 w-3" />
                {localFilters.startDate ? format(new Date(localFilters.startDate), "MMM d, yyyy") : "N/A"} - {localFilters.endDate ? format(new Date(localFilters.endDate), "MMM d, yyyy") : "N/A"}
              </p>
            </div>
          </div>
        ) : (
          <div className="grid gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    "w-full justify-start text-left font-normal h-9",
                    !localFilters.startDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-3 w-3" />
                  {localFilters.startDate ? format(new Date(localFilters.startDate), "PP") : "From Date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={localFilters.startDate ? new Date(localFilters.startDate) : undefined}
                  onSelect={(date) => updateFilter("startDate", date?.toISOString())}
                  initialFocus
                />
              </PopoverContent>
            </Popover>

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    "w-full justify-start text-left font-normal h-9",
                    !localFilters.endDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-3 w-3" />
                  {localFilters.endDate ? format(new Date(localFilters.endDate), "PP") : "To Date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={localFilters.endDate ? new Date(localFilters.endDate) : undefined}
                  onSelect={(date) => updateFilter("endDate", date?.toISOString())}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        )}
      </div>

      {/* Search Bar */}
      <div className="space-y-2">
        <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Search</Label>
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="JE no., account, description"
            className="pl-8 h-9 text-sm"
            value={localFilters.search}
            onChange={(e) => updateFilter("search", e.target.value)}
          />
        </div>
      </div>

      {/* Selects Grid */}
      {[
        { label: "Branch", key: "branch", items: ["All Branches"] },
        { label: "Division", key: "division", items: ["All Divisions"] },
        { label: "Department", key: "department", items: ["All Departments"] },
        { label: "Entry Type", key: "entryType", items: ["All Entry Types", "Sales", "Purchase", "Adjustment", "Accrual"] },
        { label: "Source Module", key: "sourceModule", items: uniqueSourceModules.length > 0 ? uniqueSourceModules : ["All Source Modules"] },
        { label: "Entry Status", key: "status", items: ["All Statuses", "Posted", "For Review", "Approved", "Draft"] },
      ].map((item) => (
        <div key={item.key} className="space-y-2">
          <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{item.label}</Label>
          <Select
            value={(localFilters as any)[item.key]}
            onValueChange={(v) => updateFilter(item.key as keyof FilterState, v)}
          >
            <SelectTrigger className="h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {item.items.map((opt) => (
                <SelectItem key={opt} value={opt} className="text-sm">{opt}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ))}

      {/* Checkbox Filter */}
      <div className="flex items-center space-x-2 bg-muted/30 p-3 rounded-lg border border-dashed">
        <Checkbox
          id="postedOnly"
          checked={localFilters.showPostedOnly}
          onCheckedChange={(checked) => updateFilter("showPostedOnly", checked)}
        />
        <Label htmlFor="postedOnly" className="text-sm font-medium leading-none cursor-pointer">
          View only posted entries
        </Label>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 pt-4 border-t sticky bottom-0 bg-background pb-4">
        <Button
          variant="outline"
          className="flex-1 h-9 text-sm"
          onClick={onReset}
        >
          <RotateCcw className="mr-2 h-3.5 w-3.5" />
          Reset
        </Button>
        <Button
          className="flex-1 h-9 text-sm shadow-indigo-100 shadow-md"
          onClick={handleApplyFilter}
        >
          <Filter className="mr-2 h-3.5 w-3.5" />
          Filter
        </Button>
      </div>
    </div>
  );
}
