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

interface WerOrganizationComboboxProps {
  id: string;
  value: string;
  options: { value: string; label: string }[];
  placeholder: string;
  searchLabel: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
}

export function WerOrganizationCombobox({
  id,
  value,
  options,
  placeholder,
  searchLabel,
  onValueChange,
  disabled = false,
}: WerOrganizationComboboxProps) {
  const [open, setOpen] = useState(false);
  const selectedLabel = options.find((option) => option.value === value)?.label;

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
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn("w-full min-w-0 justify-between font-normal", !value && "text-muted-foreground")}
        >
          <span className="truncate">{selectedLabel || placeholder}</span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] min-w-64 p-0" align="start">
        <Command>
          <CommandInput placeholder={`Search ${searchLabel}...`} />
          <CommandList ref={guardListWheel} className="max-h-64 overflow-y-auto">
            <CommandEmpty>No {searchLabel} found.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value={placeholder}
                onSelect={() => {
                  onValueChange("");
                  setOpen(false);
                }}
              >
                <Check className={cn("mr-2 size-4", !value ? "opacity-100" : "opacity-0")} />
                {placeholder}
              </CommandItem>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.label}
                  onSelect={() => {
                    onValueChange(option.value);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("mr-2 size-4", value === option.value ? "opacity-100" : "opacity-0")} />
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
