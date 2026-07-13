"use client";

import * as React from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon, X, Search } from "lucide-react";
import { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList } from "@/components/ui/combobox";

type SupplierOption = { name: string; id: string };

type PRFiltersProps = {
  procurementNo: string;
  status: string;
  supplierLabel: string | null;
  dateFrom: string | null;
  dateTo: string | null;
  onProcurementNoChange: (v: string) => void;
  onStatusChange: (v: string) => void;
  onSupplierChange: (v: string, label: string | null) => void;
  onDateChange: (from: string | null, to: string | null) => void;
  tableSupplierOptions: SupplierOption[];
};

export function PRFilters({
  procurementNo, status, supplierLabel, dateFrom, dateTo,
  onProcurementNoChange, onStatusChange, onSupplierChange, onDateChange,
  tableSupplierOptions,
}: PRFiltersProps) {
  const [supplierSearchText, setSupplierSearchText] = React.useState("");
  const [supplierOpen, setSupplierOpen] = React.useState(false);

  const filteredSupplierOptions = React.useMemo(
    () => supplierSearchText.trim()
      ? tableSupplierOptions.filter((s) => s.name.toLowerCase().includes(supplierSearchText.toLowerCase()))
      : tableSupplierOptions,
    [tableSupplierOptions, supplierSearchText]
  );

  const dateRange: DateRange | undefined = React.useMemo(() => {
    if (!dateFrom && !dateTo) return undefined;
    return {
      from: dateFrom ? new Date(dateFrom) : undefined,
      to: dateTo ? new Date(dateTo) : undefined,
    };
  }, [dateFrom, dateTo]);

  function handleDateSelect(range: DateRange | undefined) {
    if (!range) { onDateChange(null, null); return; }
    onDateChange(
      range.from ? format(range.from, "yyyy-MM-dd") : null,
      range.to ? format(range.to, "yyyy-MM-dd") : null
    );
  }

  const supplierCombobox = (
    <div className="w-full lg:w-[200px] shrink-0">
      <label className="text-xs text-muted-foreground mb-1 block">Supplier</label>
      <Combobox items={filteredSupplierOptions.map((s) => s.name)} value={supplierLabel ?? ""}
        open={supplierOpen} onOpenChange={setSupplierOpen}
        onValueChange={(name: string | null) => {
          if (name) {
            onSupplierChange(name, name);
          } else {
            onSupplierChange("", null);
            setSupplierSearchText("");
          }
          setSupplierOpen(false);
        }}
      >
        <ComboboxInput placeholder="Any supplier" showClear
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSupplierSearchText(e.target.value)}
        />
        <ComboboxContent>
          <ComboboxEmpty>{supplierSearchText.trim() ? "No results." : (tableSupplierOptions.length === 0 ? "No suppliers in table" : "")}</ComboboxEmpty>
          <ComboboxList>{(name: string) => <ComboboxItem key={name} value={name}>{name}</ComboboxItem>}</ComboboxList>
        </ComboboxContent>
      </Combobox>
    </div>
  );

  return (
    <div className="flex flex-col lg:flex-row lg:items-end gap-3">
      <div className="w-full lg:w-[220px] shrink-0">
        <label className="text-xs text-muted-foreground mb-1 block">PR No.</label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9 h-9" placeholder="Search by PR No." value={procurementNo} onChange={(e) => onProcurementNoChange(e.target.value)} />
        </div>
      </div>
      <div className="hidden lg:block flex-1" />
      <div className="flex flex-col lg:flex-row lg:items-end gap-3 w-full lg:w-auto">
        {supplierCombobox}
        <div className="w-full lg:w-[220px] shrink-0">
          <label className="text-xs text-muted-foreground mb-1 block">Lead Date</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-full justify-start text-left font-normal h-9", !dateFrom && !dateTo && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                <span className="truncate text-xs">
                  {dateFrom ? (dateTo ? <>{format(new Date(dateFrom), "LLL dd, y")} - {format(new Date(dateTo), "LLL dd, y")}</> : format(new Date(dateFrom), "LLL dd, y")) : "Pick a date range"}
                </span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <div className="flex items-center justify-between p-3 border-b">
                <span className="text-xs font-medium">Filter by lead date</span>
                {(dateFrom || dateTo) && (
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onDateChange(null, null)}>
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
              <Calendar initialFocus mode="range" selected={dateRange} onSelect={handleDateSelect} numberOfMonths={2} className="p-2" />
            </PopoverContent>
          </Popover>
        </div>
        <div className="w-full lg:w-[160px] shrink-0">
          <label className="text-xs text-muted-foreground mb-1 block">Status</label>
          <Select value={status} onValueChange={onStatusChange}>
            <SelectTrigger className="h-9 w-full">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
