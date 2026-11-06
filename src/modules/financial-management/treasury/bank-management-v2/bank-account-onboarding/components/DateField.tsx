"use client";

import { CalendarIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn, formatDateLong, toISODate } from "@/lib/utils";

type DateFieldProps = Omit<React.ComponentProps<typeof Button>, "onChange" | "value"> & {
  value: string;
  onChange: (value: string) => void;
  /** Latest selectable day, inclusive, as `YYYY-MM-DD`. */
  maxDate?: string;
  placeholder?: string;
};

function parseDate(value: string): Date | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/** Date picker used instead of the banned native date input; emits `YYYY-MM-DD`. */
export function DateField({ value, onChange, maxDate, placeholder = "Pick a date", className, ...buttonProps }: DateFieldProps) {
  const selected = parseDate(value);
  const max = maxDate ? parseDate(maxDate) : undefined;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          {...buttonProps}
          type="button"
          variant="outline"
          className={cn("w-full justify-between font-normal", className)}
        >
          <span
            className={cn("min-w-0 flex-1 truncate text-left", !selected && "text-muted-foreground")}
            title={selected ? formatDateLong(selected) : undefined}
          >
            {selected ? formatDateLong(selected) : placeholder}
          </span>
          <CalendarIcon className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(day) => {
            if (day) onChange(toISODate(day));
          }}
          disabled={max ? { after: max } : undefined}
        />
      </PopoverContent>
    </Popover>
  );
}
