"use client";

import { useCallback, useState } from "react";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { PayableCoaOption } from "../services/logisticsWerApi";

interface WerCoaComboboxProps {
  value: string;
  options: PayableCoaOption[];
  onValueChange: (value: string) => void;
  disabled?: boolean;
}

/** Searchable account picker for the 60+ chart-of-accounts options. */
export function WerCoaCombobox({ value, options, onValueChange, disabled = false }: WerCoaComboboxProps) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => String(option.coaId) === value);

  // The dropdown list is portaled outside the modal details sheet, so the
  // sheet's scroll lock would cancel wheel events on it. Stopping propagation
  // with a native target-phase listener keeps native list scrolling intact.
  const guardListWheel = useCallback((node: HTMLDivElement | null) => {
    if (!node) return undefined;
    const stopWheelPropagation = (event: WheelEvent) => event.stopPropagation();
    node.addEventListener("wheel", stopWheelPropagation);
    return () => node.removeEventListener("wheel", stopWheelPropagation);
  }, []);

  return (
    <Popover open={open} onOpenChange={setOpen} modal={false}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn("w-full justify-between font-normal", !value && "text-muted-foreground")}
        >
          <span className="truncate">{selected ? selected.label : "Select account…"}</span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] min-w-64 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search accounts…" />
          <CommandList ref={guardListWheel} className="max-h-64 overflow-y-auto">
            <CommandEmpty>No accounts found.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.coaId}
                  value={option.label}
                  onSelect={() => {
                    onValueChange(String(option.coaId));
                    setOpen(false);
                  }}
                >
                  <Check className={cn("mr-2 size-4", value === String(option.coaId) ? "opacity-100" : "opacity-0")} />
                  <span className="truncate">{option.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
