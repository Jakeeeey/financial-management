"use client";

import { useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContentInDialog, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

import type { ExpenseAccountOption } from "../types";

interface ExpenseAccountPickerProps {
  id?: string;
  options: ExpenseAccountOption[];
  /** Selected `coa_id` as a string, `""` when nothing is chosen. */
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  invalid?: boolean;
}

/** Searchable expense-account combobox (QA §5.2): trigger says what is picked, list is capped. */
export function ExpenseAccountPicker({
  id,
  options,
  value,
  onChange,
  disabled,
  invalid,
}: ExpenseAccountPickerProps) {
  const [open, setOpen] = useState(false);
  const selected = useMemo(() => options.find((option) => String(option.coaId) === value), [options, value]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-invalid={invalid}
          disabled={disabled}
          className={cn(
            "h-9 w-full justify-between gap-2 font-normal",
            !selected && "text-muted-foreground",
          )}
        >
          <span className="min-w-0 flex-1 truncate text-left">
            {selected ? `${selected.glCode} — ${selected.title}` : "Choose an expense account"}
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContentInDialog className="w-(--radix-popover-trigger-width) p-0" align="start">
        <Command>
          <CommandInput placeholder="Search by code or title" />
          <CommandList className="max-h-64 overflow-y-auto overscroll-contain">
            <CommandEmpty>No expense account matches that search.</CommandEmpty>
            {options.map((option) => (
              <CommandItem
                key={option.coaId}
                value={`${option.glCode} ${option.title}`}
                onSelect={() => {
                  onChange(String(option.coaId));
                  setOpen(false);
                }}
                className="flex items-center gap-2"
              >
                <Check
                  className={cn("h-4 w-4 shrink-0", String(option.coaId) === value ? "opacity-100" : "opacity-0")}
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1 truncate" title={`${option.glCode} — ${option.title}`}>
                  {option.glCode} — {option.title}
                </span>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContentInDialog>
    </Popover>
  );
}
