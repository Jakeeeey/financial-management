"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";

export type ComboItem = { id: number; label: string };

type Props = {
    valueId: number | null;
    valueLabel?: string | null;
    placeholder: string;
    searchPlaceholder: string;
    minChars?: number;
    onChange: (next: { id: number; label: string } | null) => void;

    // async fetcher when user types
    fetchItems: (q: string, signal?: AbortSignal) => Promise<ComboItem[]>;
};

export function AsyncCombobox({
                                  valueId,
                                  valueLabel,
                                  placeholder,
                                  searchPlaceholder,
                                  minChars = 2,
                                  onChange,
                                  fetchItems,
                              }: Props) {
    const [open, setOpen] = React.useState(false);
    const [q, setQ] = React.useState("");
    const [loading, setLoading] = React.useState(false);
    const [items, setItems] = React.useState<ComboItem[]>([]);

    React.useEffect(() => {
        if (!open) return;

        const ac = new AbortController();
        const trimmed = q.trim();

        if (trimmed.length < minChars) {
            setItems([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        fetchItems(trimmed, ac.signal)
            .then((rows) => setItems(rows ?? []))
            .catch(() => setItems([]))
            .finally(() => {
                if (!ac.signal.aborted) setLoading(false);
            });

        return () => ac.abort();
    }, [open, q, minChars, fetchItems]);

    const selectedText =
        valueId && valueLabel ? valueLabel : valueId ? `#${valueId}` : "";

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between"
                >
          <span className={cn("truncate text-left", !selectedText && "text-muted-foreground")}>
            {selectedText || placeholder}
          </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-60" />
                </Button>
            </PopoverTrigger>

            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command shouldFilter={false}>
                    <CommandInput
                        placeholder={searchPlaceholder}
                        value={q}
                        onValueChange={setQ}
                    />
                    <CommandList>
                        {loading ? (
                            <div className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Loading…
                            </div>
                        ) : null}

                        {!loading && q.trim().length < minChars ? (
                            <div className="px-3 py-3 text-sm text-muted-foreground">
                                Type at least {minChars} character(s)…
                            </div>
                        ) : null}

                        <CommandEmpty>No results.</CommandEmpty>

                        <CommandGroup>
                            {items.map((it) => {
                                const selected = valueId === it.id;
                                return (
                                    <CommandItem
                                        key={it.id}
                                        value={`${it.id}`}
                                        onSelect={() => {
                                            onChange({ id: it.id, label: it.label });
                                            setOpen(false);
                                        }}
                                    >
                                        <Check className={cn("mr-2 h-4 w-4", selected ? "opacity-100" : "opacity-0")} />
                                        <span className="truncate">{it.label}</span>
                                    </CommandItem>
                                );
                            })}
                        </CommandGroup>

                        {valueId ? (
                            <div className="border-t p-2">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    className="w-full justify-start"
                                    onClick={() => {
                                        onChange(null);
                                        setOpen(false);
                                    }}
                                >
                                    Clear selection
                                </Button>
                            </div>
                        ) : null}
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
