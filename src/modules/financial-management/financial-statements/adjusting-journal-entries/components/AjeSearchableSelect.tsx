"use client";

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

import type { LookupOption } from "../types";

type AjeSelectOption = LookupOption & { disabled?: boolean; disabledReason?: string };

type AjeSearchableSelectProps = {
  options: AjeSelectOption[];
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  ariaInvalid?: boolean;
  ariaLabel?: string;
  ariaDescribedBy?: string;
};

export function AjeSearchableSelect({
  options,
  value,
  onValueChange,
  placeholder = "Select option",
  disabled = false,
  className,
  ariaInvalid,
  ariaLabel,
  ariaDescribedBy,
}: AjeSearchableSelectProps) {
  const [open, setOpen] = React.useState(false);
  const selectedLabel = React.useMemo(
    () => options.find((option) => option.value === value)?.label,
    [options, value],
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-invalid={ariaInvalid}
          aria-label={ariaLabel}
          aria-describedby={ariaDescribedBy}
          className={cn("w-full justify-between", !value && "text-muted-foreground", className)}
          disabled={disabled}
        >
          <span className="truncate">{selectedLabel || placeholder}</span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder={`Search ${placeholder.toLowerCase()}...`} />
          <CommandList
            className="max-h-72 overscroll-contain"
            onWheel={(event) => event.stopPropagation()}
            onTouchMove={(event) => event.stopPropagation()}
          >
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.label}
                  disabled={option.disabled}
                  title={option.disabledReason}
                  onSelect={() => {
                    onValueChange(option.value);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 size-4",
                      value === option.value ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="truncate">{option.label}</span>
                  {option.disabledReason && <span className="ml-auto shrink-0 text-xs text-muted-foreground">{option.disabledReason}</span>}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
