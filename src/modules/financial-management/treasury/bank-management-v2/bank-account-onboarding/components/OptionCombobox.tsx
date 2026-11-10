"use client";

import { useState } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type ComboboxOption = {
  value: string;
  label: string;
  /** Text cmdk matches against; use it to search on codes the label hides. */
  searchText?: string;
  description?: string;
};

type OptionComboboxProps = Omit<React.ComponentProps<typeof Button>, "onChange" | "value"> & {
  options: ComboboxOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  searchPlaceholder: string;
  emptyLabel: string;
  /** Lets the user pick a name that is not in the list yet, e.g. a new bank. */
  allowCustom?: boolean;
};

/** Searchable list picker over DB-sourced options, per QA.md's combobox rules. */
export function OptionCombobox({
  options,
  value,
  onChange,
  placeholder,
  searchPlaceholder,
  emptyLabel,
  allowCustom = false,
  className,
  ...buttonProps
}: OptionComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selected = options.find((option) => option.value === value);
  const query = search.trim();
  // cmdk clears its search on select, so the custom name is kept in its own state
  // and only updated from the input handler (never during render).
  const [customLabel, setCustomLabel] = useState("");
  const customOffered =
    allowCustom && query !== "" && !options.some((option) => option.label.toLowerCase() === query.toLowerCase());

  function choose(next: string) {
    onChange(next);
    setOpen(false);
    setSearch("");
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setSearch("");
          setCustomLabel("");
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button
          {...buttonProps}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between font-normal", className)}
        >
          <span
            className={cn("min-w-0 flex-1 truncate text-left", !selected && !(allowCustom && value) && "text-muted-foreground")}
            title={selected?.label ?? (allowCustom && value ? value : undefined)}
          >
            {selected?.label ?? (allowCustom && value ? value : placeholder)}
          </span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
        <Command>
          <CommandInput
            placeholder={searchPlaceholder}
            value={search}
            onValueChange={(next) => {
              setSearch(next);
              if (next.trim() !== "") setCustomLabel(next);
            }}
          />
          <CommandList
            className="max-h-64 overflow-y-auto overscroll-contain"
            onWheelCapture={(event) => event.stopPropagation()}
          >
            <CommandEmpty>{emptyLabel}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.searchText ?? option.label}
                  onSelect={() => choose(option.value)}
                >
                  <Check
                    className={cn("mr-2 size-4 shrink-0", value === option.value ? "opacity-100" : "opacity-0")}
                  />
                  <span className="min-w-0 flex-1 truncate" title={option.label}>
                    {option.label}
                  </span>
                  {option.description ? (
                    <span className="ml-2 shrink-0 text-xs tabular-nums text-muted-foreground">
                      {option.description}
                    </span>
                  ) : null}
                </CommandItem>
              ))}
              {customOffered ? (
                <CommandItem value={customLabel.trim()} onSelect={() => choose(customLabel.trim())}>
                  <Plus className="mr-2 size-4 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">Use “{query}”</span>
                </CommandItem>
              ) : null}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
