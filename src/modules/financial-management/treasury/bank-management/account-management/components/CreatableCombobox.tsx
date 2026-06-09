"use client";

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
import { Check, ChevronsUpDown, Loader2, Plus } from "lucide-react";
import { useState } from "react";
import { normalizeOptionInput } from "./utils";

type ComboboxOption = {
  value: string;
  label: string;
};

type CreatableComboboxProps = {
  options: ComboboxOption[];
  value: string;
  placeholder: string;
  searchPlaceholder: string;
  emptyText: string;
  disabled?: boolean;
  creating?: boolean;
  onValueChange: (value: string) => void;
  onCreate: (value: string) => void;
};

export function CreatableCombobox({
  options,
  value,
  placeholder,
  searchPlaceholder,
  emptyText,
  disabled,
  creating,
  onValueChange,
  onCreate,
}: CreatableComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selectedOption = options.find((option) => option.value === value);
  const normalizedQuery = normalizeOptionInput(query);
  const normalizedQueryKey = normalizedQuery.toLowerCase();
  const visibleOptions = normalizedQueryKey
    ? options.filter((option) =>
        normalizeOptionInput(option.label).toLowerCase().includes(normalizedQueryKey),
      )
    : options;
  const canCreate = Boolean(normalizedQuery) && !disabled && !creating;

  function createOption() {
    if (!canCreate) return;

    onCreate(normalizedQuery);
    setQuery("");
    setOpen(false);
  }

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) setQuery("");
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn("w-full min-w-0 justify-between", !value && "text-muted-foreground")}
        >
          <span className="min-w-0 flex-1 truncate text-left">
            {selectedOption?.label || value || placeholder}
          </span>
          {creating ? (
            <Loader2 className="ml-2 h-4 w-4 shrink-0 animate-spin opacity-70" />
          ) : (
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            value={query}
            disabled={disabled || creating}
            placeholder={searchPlaceholder}
            onValueChange={setQuery}
          />
          <CommandList
            className="max-h-64 overflow-y-auto"
            onWheelCapture={(event) => event.stopPropagation()}
          >
            {visibleOptions.length === 0 && !canCreate ? (
              <CommandEmpty>{emptyText}</CommandEmpty>
            ) : null}
            {visibleOptions.length > 0 || canCreate ? (
              <CommandGroup>
                {canCreate ? (
                  <CommandItem
                    key="__create_option"
                    value={`Add ${normalizedQuery}`}
                    onSelect={() => {
                      createOption();
                    }}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    <span className="truncate">Add &quot;{normalizedQuery}&quot;</span>
                  </CommandItem>
                ) : null}
                {visibleOptions.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={option.value}
                    onSelect={() => {
                      onValueChange(option.value);
                      setOpen(false);
                    }}
                  >
                    <Check className={cn("mr-2 h-4 w-4", value === option.value ? "opacity-100" : "opacity-0")} />
                    {option.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
