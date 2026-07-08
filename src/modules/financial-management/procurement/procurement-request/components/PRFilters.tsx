"use client";

import * as React from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon, X, Search } from "lucide-react";
import { DateRange } from "react-day-picker";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { searchSuppliers } from "../providers/lookupsService";

type PRFiltersProps = {
  procurementNo: string;
  status: string;
  supplierId: string;
  supplierLabel: string | null;
  dateFrom: string | null;
  dateTo: string | null;
  onProcurementNoChange: (v: string) => void;
  onStatusChange: (v: string) => void;
  onSupplierChange: (v: string, label: string | null) => void;
  onDateChange: (from: string | null, to: string | null) => void;
};

export function PRFilters({
  procurementNo,
  status,
  supplierId,
  supplierLabel,
  dateFrom,
  dateTo,
  onProcurementNoChange,
  onStatusChange,
  onSupplierChange,
  onDateChange,
}: PRFiltersProps) {
  /* Supplier async combobox state */
  const [supplierSearchText, setSupplierSearchText] = React.useState("");
  const [supplierOpen, setSupplierOpen] = React.useState(false);
  const [supplierNameItems, setSupplierNameItems] = React.useState<string[]>(() =>
    supplierLabel ? [supplierLabel] : []
  );
  const supplierIdByName = React.useRef<Record<string, string>>({});

  React.useEffect(() => {
    if (supplierSearchText.trim().length < 1) {
      setSupplierNameItems(supplierLabel ? [supplierLabel] : []);
      setSupplierOpen(false);
      return;
    }
    const ac = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const rows = await searchSuppliers(supplierSearchText.trim(), ac.signal);
        if (!ac.signal.aborted) {
          const names = rows.map((r) => r.supplier_name);
          const map: Record<string, string> = {};
          rows.forEach((r) => {
            map[r.supplier_name] = String(r.id);
          });
          supplierIdByName.current = map;
          setSupplierNameItems(names);
          if (names.length > 0) setSupplierOpen(true);
          else setSupplierOpen(false);
        }
      } catch {
        if (!ac.signal.aborted) setSupplierNameItems([]);
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      ac.abort();
    };
  }, [supplierSearchText, supplierId, supplierLabel]);

  const dateRange: DateRange | undefined = React.useMemo(() => {
    if (!dateFrom && !dateTo) return undefined;
    return {
      from: dateFrom ? new Date(dateFrom) : undefined,
      to: dateTo ? new Date(dateTo) : undefined,
    };
  }, [dateFrom, dateTo]);

  function handleDateSelect(range: DateRange | undefined) {
    if (!range) {
      onDateChange(null, null);
      return;
    }
    onDateChange(
      range.from ? format(range.from, "yyyy-MM-dd") : null,
      range.to ? format(range.to, "yyyy-MM-dd") : null
    );
  }

  const rightGroup = (
    <div className="flex flex-col lg:flex-row items-end gap-3 shrink-0 w-full">
      {/* Supplier */}
      <div className="w-full lg:w-[200px] shrink-0">
        <label className="text-xs text-muted-foreground mb-1 block">Supplier</label>
        <Combobox
          items={supplierNameItems}
          value={supplierLabel ?? ""}
          open={supplierOpen}
          onOpenChange={setSupplierOpen}
          onValueChange={(name: string | null) => {
            if (name) {
              const id = supplierIdByName.current[name] ?? "";
              onSupplierChange(id, name);
            } else {
              onSupplierChange("", null);
              setSupplierSearchText("");
            }
          }}
        >
          <ComboboxInput
            placeholder="Any supplier"
            showClear
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setSupplierSearchText(e.target.value)
            }
          />
          <ComboboxContent>
            <ComboboxEmpty>{supplierSearchText.trim() ? "No results." : "Type to search suppliers"}</ComboboxEmpty>
            <ComboboxList>
              {(name: string) => (
                <ComboboxItem key={name} value={name}>
                  {name}
                </ComboboxItem>
              )}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
      </div>

      {/* Lead Date Range */}
      <div className="w-full lg:w-[220px] shrink-0">
        <label className="text-xs text-muted-foreground mb-1 block">Lead Date</label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-full justify-start text-left font-normal h-9",
                !dateFrom && !dateTo && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              <span className="truncate text-xs">
                {dateFrom ? (
                  dateTo ? (
                    <>
                      {format(new Date(dateFrom), "LLL dd, y")} - {format(new Date(dateTo), "LLL dd, y")}
                    </>
                  ) : (
                    format(new Date(dateFrom), "LLL dd, y")
                  )
                ) : (
                  "Pick a date range"
                )}
              </span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <div className="flex items-center justify-between p-3 border-b">
              <span className="text-xs font-medium">Filter by lead date</span>
              {(dateFrom || dateTo) && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => onDateChange(null, null)}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
            <Calendar
              initialFocus
              mode="range"
              selected={dateRange}
              onSelect={handleDateSelect}
              numberOfMonths={2}
              className="p-2"
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Status */}
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
  );

  return (
    <div className="flex flex-col gap-3">
      {/* Top row: desktop side-by-side, mobile stacks */}
      <div className="flex flex-col lg:flex-row lg:items-end lg:gap-3 lg:justify-between">
        {/* PR No. */}
        <div className="w-full lg:w-[220px] shrink-0">
          <label className="text-xs text-muted-foreground mb-1 block">PR No.</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9 h-9"
              placeholder="Search by PR No."
              value={procurementNo}
              onChange={(e) => onProcurementNoChange(e.target.value)}
            />
          </div>
        </div>

        {/* Desktop spacer */}
        <div className="hidden lg:block flex-1" />

        {/* Desktop right group */}
        <div className="hidden lg:flex items-end gap-3 shrink-0">
          {rightGroup}
        </div>
      </div>

      {/* Mobile: rightGroup renders flex-col natively */}
      <div className="lg:hidden">{rightGroup}</div>
    </div>
  );
}
