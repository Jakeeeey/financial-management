"use client";

import { useState } from "react";
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

interface BalanceSheetSearchableSelectProps {
    id: string;
    value: string;
    options: { value: string; label: string }[];
    onValueChange: (value: string) => void;
    placeholder: string;
    disabled?: boolean;
    className?: string;
}

const ALL_OPTION_VALUE = "__all_balance_sheet_options__";

export function BalanceSheetSearchableSelect({
    id,
    value,
    options,
    onValueChange,
    placeholder,
    disabled = false,
    className,
}: BalanceSheetSearchableSelectProps) {
    const [open, setOpen] = useState(false);
    const selectedLabel = options.find((option) => option.value === value)?.label || value;

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    id={id}
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    aria-label={`${placeholder.replace(/^All /, "")} filter`}
                    title={selectedLabel || placeholder}
                    disabled={disabled}
                    className={cn("h-9 w-full min-w-0 justify-between overflow-hidden text-xs font-medium", className)}
                >
                    <span className="min-w-0 flex-1 truncate text-left">
                        {selectedLabel || placeholder}
                    </span>
                    <ChevronsUpDown aria-hidden="true" className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent
                align="start"
                className="w-[var(--radix-popover-trigger-width)] p-0"
            >
                <Command>
                    <CommandInput placeholder={`Search ${placeholder.replace(/^All /, "").toLowerCase()}...`} />
                    <CommandList>
                        <CommandEmpty>No matching options.</CommandEmpty>
                        <CommandGroup>
                            <CommandItem
                                value={`${ALL_OPTION_VALUE} ${placeholder}`}
                                onSelect={() => {
                                    onValueChange("");
                                    setOpen(false);
                                }}
                            >
                                <Check className={cn("h-4 w-4 shrink-0", value ? "opacity-0" : "opacity-100")} />
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
                                    <Check className={cn("h-4 w-4 shrink-0", value === option.value ? "opacity-100" : "opacity-0")} />
                                    <span className="min-w-0 truncate">{option.label}</span>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
