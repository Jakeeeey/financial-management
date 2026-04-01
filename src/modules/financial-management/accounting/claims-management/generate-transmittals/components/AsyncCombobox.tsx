"use client";

import * as React from "react";
import { Check, ChevronDown, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";

type Item = { id: number; label: string };

type Props = {
    value: Item | null;
    onChange: (next: Item | null) => void;

    placeholder: string;
    searchPlaceholder: string;

    disabled?: boolean;
    emptyHint?: string;
    // type-first fetch
    fetchItems: (q: string, signal?: AbortSignal) => Promise<Item[]>;
};

export function AsyncCombobox({
                                  value,
                                  onChange,
                                  placeholder,
                                  searchPlaceholder,
                                  disabled,
                                  emptyHint,
                                  fetchItems,
                              }: Props) {
    const [open, setOpen] = React.useState(false);
    const [q, setQ] = React.useState("");
    const [items, setItems] = React.useState<Item[]>([]);
    const [loading, setLoading] = React.useState(false);

    const [debouncedQ, setDebouncedQ] = React.useState(q);

    React.useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedQ(q);
        }, 300);
        return () => clearTimeout(timer);
    }, [q]);

    React.useEffect(() => {
        if (!open) return;

        const ac = new AbortController();
        setLoading(true);

        fetchItems(debouncedQ.trim(), ac.signal)
            .then((rows) => {
                if (!ac.signal.aborted) setItems(rows);
            })
            .catch((err) => {
                if (err.name === "AbortError") return;
                console.error("AsyncCombobox fetch error:", err);
            })
            .finally(() => {
                if (!ac.signal.aborted) setLoading(false);
            });

        return () => ac.abort();
    }, [open, debouncedQ, fetchItems]);

    return (
        <Popover open={open} onOpenChange={(v) => !disabled && setOpen(v)}>
            <PopoverTrigger asChild>
                <Button
                    type="button"
                    variant="outline"
                    disabled={disabled}
                    className={cn("w-full justify-between", !value && "text-muted-foreground")}
                >
          <span className="truncate">
            {value ? value.label : placeholder}
          </span>

                    {loading ? (
                        <Loader2 className="ml-2 h-4 w-4 shrink-0 animate-spin" />
                    ) : (
                        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    )}
                </Button>
            </PopoverTrigger>

            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command shouldFilter={false}>
                    <CommandInput
                        placeholder={searchPlaceholder}
                        value={q}
                        onValueChange={setQ}
                        autoFocus
                    />
                    <CommandList>
                        <CommandEmpty>
                            {q.trim() ? "No results." : (emptyHint ?? "Type to search…")}
                        </CommandEmpty>


                        <CommandGroup>
                            {items.map((it) => {
                                const selected = value?.id === it.id;
                                return (
                                    <CommandItem
                                        key={it.id}
                                        value={String(it.id)}
                                        onSelect={() => {
                                            onChange(selected ? null : it);
                                            setOpen(false);
                                        }}
                                    >
                                        <Check className={cn("mr-2 h-4 w-4", selected ? "opacity-100" : "opacity-0")} />
                                        <span className="truncate">{it.label}</span>
                                    </CommandItem>
                                );
                            })}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
