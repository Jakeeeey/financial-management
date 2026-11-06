"use client";

import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverContentInDialog,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface DateFieldProps {
  id?: string;
  /** `YYYY-MM-DD`, PHT wall clock. */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Set inside a Dialog: a portalled popover is dismissed by the dialog's layer on click. */
  inDialog?: boolean;
  className?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}

/** `2026-11-06` → local midnight, so a calendar pick never shifts a day. */
export function parseDateValue(value: string): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? "");
  if (!match) return undefined;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/** The picker's calendar date back to the stored `YYYY-MM-DD` shape. */
export function formatDateValue(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export function DateField({
  id,
  value,
  onChange,
  placeholder = "Pick a date",
  disabled,
  inDialog = false,
  className,
  ...aria
}: DateFieldProps) {
  const selected = parseDateValue(value);
  const Content = inDialog ? PopoverContentInDialog : PopoverContent;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          aria-invalid={aria["aria-invalid"]}
          aria-describedby={aria["aria-describedby"]}
          className={cn(
            "h-9 w-full justify-start gap-2 text-left font-normal",
            !selected && "text-muted-foreground",
            className,
          )}
        >
          <CalendarIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="truncate">{selected ? format(selected, "LLL dd, y") : placeholder}</span>
        </Button>
      </PopoverTrigger>
      <Content className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected}
          onSelect={(date) => {
            if (date) onChange(formatDateValue(date));
          }}
        />
      </Content>
    </Popover>
  );
}
