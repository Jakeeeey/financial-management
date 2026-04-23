"use client";

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";

import { cn } from "@/lib/utils";
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

export interface SearchableSelectProps {
    options: { value: string; label: string }[];
    value?: string;
    onValueChange: (value: string) => void;
    placeholder?: string;
    disabled?: boolean;
    className?: string;
}

const VISIBLE_LIMIT = 100;

export function SearchableSelect({
    options,
    value,
    onValueChange,
    placeholder = "Select option...",
    disabled = false,
    className,
}: SearchableSelectProps) {
    const [open, setOpen] = React.useState(false);
    const [search, setSearch] = React.useState("");

    // Resolve display label for current value
    const selectedLabel = React.useMemo(
        () => options.find((opt) => opt.value === value)?.label,
        [options, value]
    );

    // Client-side filter + cap — prevents flooding the DOM with thousands of nodes
    const visibleOptions = React.useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return options.slice(0, VISIBLE_LIMIT);
        const filtered = options.filter((opt) =>
            opt.label.toLowerCase().includes(q)
        );
        return filtered.slice(0, VISIBLE_LIMIT);
    }, [options, search]);

    const handleOpenChange = (next: boolean) => {
        setOpen(next);
        if (!next) setSearch(""); // clear search when closed
    };

    return (
        <Popover open={open} onOpenChange={handleOpenChange}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className={cn(
                        "w-full justify-between",
                        !value && "text-muted-foreground",
                        className
                    )}
                    disabled={disabled}
                >
                    <span className="truncate flex-1 text-left">
                        {selectedLabel || placeholder}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                {/* shouldFilter=false: we handle filtering ourselves above */}
                <Command shouldFilter={false}>
                    <CommandInput
                        placeholder={`Search ${placeholder.toLowerCase()}...`}
                        value={search}
                        onValueChange={setSearch}
                    />
                    <CommandList>
                        <CommandEmpty>No results found.</CommandEmpty>
                        <CommandGroup>
                            {visibleOptions.map((opt) => (
                                <CommandItem
                                    key={opt.value}
                                    value={opt.value}
                                    onSelect={() => {
                                        onValueChange(opt.value);
                                        setOpen(false);
                                        setSearch("");
                                    }}
                                >
                                    <Check
                                        className={cn(
                                            "mr-2 h-4 w-4",
                                            value === opt.value ? "opacity-100" : "opacity-0"
                                        )}
                                    />
                                    {opt.label}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                        {options.length > VISIBLE_LIMIT && search.trim() === "" && (
                            <p className="py-2 px-4 text-[10px] text-muted-foreground font-bold uppercase tracking-widest text-center opacity-60 border-t">
                                Showing {VISIBLE_LIMIT} of {options.length.toLocaleString()} — type to narrow down
                            </p>
                        )}
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
