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
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { useState } from "react";
import type { PsgcOption } from "../types";

type PsgcSelectProps = {
  options: PsgcOption[];
  value: string;
  placeholder: string;
  searchPlaceholder: string;
  emptyText: string;
  disabled?: boolean;
  loading?: boolean;
  onOpen?: () => void;
  onSelect: (option: PsgcOption) => void;
};

export function PsgcSelect({
  options,
  value,
  placeholder,
  searchPlaceholder,
  emptyText,
  disabled,
  loading,
  onOpen,
  onSelect,
}: PsgcSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selectedOption = options.find((option) => option.name === value);
  const normalizedQuery = query.trim().toLowerCase();
  const visibleOptions = (normalizedQuery
    ? options.filter((option) =>
        `${option.name} ${option.code}`.toLowerCase().includes(normalizedQuery),
      )
    : options
  ).slice(0, 100);

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) {
          setQuery("");
          onOpen?.();
        }
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
            {selectedOption?.name || value || placeholder}
          </span>
          {loading ? (
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
            onValueChange={setQuery}
            placeholder={searchPlaceholder}
          />
          <CommandList
            className="max-h-64 overflow-y-auto"
            onWheelCapture={(event) => event.stopPropagation()}
          >
            <CommandEmpty>{loading ? "Loading..." : emptyText}</CommandEmpty>
            <CommandGroup>
              {visibleOptions.map((option) => (
                <CommandItem
                  key={option.code}
                  value={`${option.name} ${option.code}`}
                  onSelect={() => {
                    onSelect(option);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === option.name ? "opacity-100" : "opacity-0")} />
                  <span className="truncate">{option.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
