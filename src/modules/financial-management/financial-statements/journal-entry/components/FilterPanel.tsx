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
  const updateFilter = (key: keyof FilterState, value: any) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="w-[300px] shrink-0 space-y-6 overflow-y-auto pr-4 border-r">
      <div className="flex items-center gap-2 font-semibold text-sm">
        <Filter className="h-4 w-4" />
        Filter Panel
      </div>

      {/* Date Range Section */}
      <div className="space-y-3">
        <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
          Date Range / Period
        </Label>
        
        <div className="grid grid-cols-2 gap-2">
            <Button 
                variant={filters.presetRange !== "Custom" ? "default" : "outline"}
                size="sm"
                className="text-xs h-8"
                onClick={() => updateFilter("presetRange", "Monthly")}
            >
                Preset Range
            </Button>
            <Button 
                variant={filters.presetRange === "Custom" ? "default" : "outline"}
                size="sm"
                className="text-xs h-8"
                onClick={() => updateFilter("presetRange", "Custom")}
            >
                Manual Range
            </Button>
        </div>

        {filters.presetRange !== "Custom" ? (
          <div className="space-y-3">
             <Select 
                value={filters.presetRange} 
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
                {filters.presetRange === "Monthly" && (
                    <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                            <Label className="text-[10px] font-bold text-muted-foreground/70 uppercase">Month</Label>
                            <Select 
                                value={filters.selectedMonth.toString()} 
                                onValueChange={(v) => updateFilter("selectedMonth", parseInt(v))}
                            >
                                <SelectTrigger className="h-9 text-[11px] bg-background">
                                    <SelectValue placeholder="Month" />
                                </SelectTrigger>
                                <SelectContent>
                                    {Array.from({ length: 12 }).map((_, i) => (
                                        <SelectItem key={i} value={i.toString()} className="text-[11px]">
                                            {format(new Date(2000, i, 1), "MMMM")}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-[10px] font-bold text-muted-foreground/70 uppercase">Year</Label>
                            <Select 
                                value={filters.selectedYear.toString()} 
                                onValueChange={(v) => updateFilter("selectedYear", parseInt(v))}
                            >
                                <SelectTrigger className="h-9 text-[11px] bg-background">
                                    <SelectValue placeholder="Year" />
                                </SelectTrigger>
                                <SelectContent>
                                    {[2024, 2025, 2026, 2027].map((y) => (
                                        <SelectItem key={y} value={y.toString()} className="text-[11px]">{y}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                )}

                {filters.presetRange === "Quarterly" && (
                    <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                            <Label className="text-[10px] font-bold text-muted-foreground/70 uppercase">Quarter</Label>
                            <Select 
                                value={filters.selectedQuarter.toString()} 
                                onValueChange={(v) => updateFilter("selectedQuarter", parseInt(v))}
                            >
                                <SelectTrigger className="h-9 text-[11px] bg-background">
                                    <SelectValue placeholder="Quarter" />
                                </SelectTrigger>
                                <SelectContent>
                                    {[1, 2, 3, 4].map((q) => (
                                        <SelectItem key={q} value={q.toString()} className="text-[11px]">Q{q}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-[10px] font-bold text-muted-foreground/70 uppercase">Year</Label>
                            <Select 
                                value={filters.selectedYear.toString()} 
                                onValueChange={(v) => updateFilter("selectedYear", parseInt(v))}
                            >
                                <SelectTrigger className="h-9 text-[11px] bg-background">
                                    <SelectValue placeholder="Year" />
                                </SelectTrigger>
                                <SelectContent>
                                    {[2024, 2025, 2026, 2027].map((y) => (
                                        <SelectItem key={y} value={y.toString()} className="text-[11px]">{y}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                )}

                {filters.presetRange === "Yearly" && (
                    <div className="space-y-1">
                        <Label className="text-[10px] font-bold text-muted-foreground/70 uppercase">Reporting Year</Label>
                        <Select 
                            value={filters.selectedYear.toString()} 
                            onValueChange={(v) => updateFilter("selectedYear", parseInt(v))}
                        >
                            <SelectTrigger className="h-9 text-[11px] bg-background">
                                <SelectValue placeholder="Year" />
                            </SelectTrigger>
                            <SelectContent>
                                {[2024, 2025, 2026, 2027].map((y) => (
                                    <SelectItem key={y} value={y.toString()} className="text-[11px]">{y}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                )}
                
                <p className="text-[10px] text-primary/70 font-semibold flex items-center gap-1.5 mt-1 px-1">
                    <CalendarIcon className="h-3 w-3" />
                    {format(new Date(filters.startDate), "MMM d, yyyy")} - {format(new Date(filters.endDate), "MMM d, yyyy")}
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
                    !filters.startDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-3 w-3" />
                  {filters.startDate ? format(new Date(filters.startDate), "PP") : "From Date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={filters.startDate ? new Date(filters.startDate) : undefined}
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
                    !filters.endDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-3 w-3" />
                  {filters.endDate ? format(new Date(filters.endDate), "PP") : "To Date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={filters.endDate ? new Date(filters.endDate) : undefined}
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
        <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Search</Label>
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input 
            placeholder="JE no., account, description" 
            className="pl-8 h-9 text-xs"
            value={filters.search}
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
          <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">{item.label}</Label>
          <Select 
            value={(filters as any)[item.key]} 
            onValueChange={(v) => updateFilter(item.key as keyof FilterState, v)}
          >
            <SelectTrigger className="h-9 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {item.items.map((opt) => (
                <SelectItem key={opt} value={opt} className="text-xs">{opt}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ))}

      {/* Checkbox Filter */}
      <div className="flex items-center space-x-2 bg-muted/30 p-3 rounded-lg border border-dashed">
        <Checkbox 
            id="postedOnly" 
            checked={filters.showPostedOnly}
            onCheckedChange={(checked) => updateFilter("showPostedOnly", checked)}
        />
        <Label htmlFor="postedOnly" className="text-xs font-medium leading-none cursor-pointer">
          View only posted entries
        </Label>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 pt-4 border-t sticky bottom-0 bg-background pb-4">
        <Button 
            variant="outline" 
            className="flex-1 h-9 text-xs"
            onClick={onReset}
        >
          <RotateCcw className="mr-2 h-3.5 w-3.5" />
          Reset
        </Button>
        <Button className="flex-1 h-9 text-xs shadow-indigo-100 shadow-md">
          <Bookmark className="mr-2 h-3.5 w-3.5" />
          Memorize
        </Button>
      </div>
    </div>
  );
}
