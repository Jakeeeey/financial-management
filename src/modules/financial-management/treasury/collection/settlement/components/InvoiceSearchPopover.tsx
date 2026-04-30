"use client";

import React from "react";
import { Search, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { UnpaidInvoice } from "../../types";

interface InvoiceSearchPopoverProps {
    searchOpen: boolean;
    setSearchOpen: (value: boolean) => void;
    searchQuery: string;
    setSearchQuery: (value: string) => void;
    isSearching: boolean;
    searchResults: UnpaidInvoice[];
    addToCart: (invoice: UnpaidInvoice) => void;
}

export default function InvoiceSearchPopover({
    searchOpen, setSearchOpen, searchQuery, setSearchQuery, isSearching, searchResults, addToCart
}: InvoiceSearchPopoverProps) {
    return (
        <Popover open={searchOpen} onOpenChange={setSearchOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" aria-expanded={searchOpen} className="w-full justify-between h-8 px-3 font-mono text-xs font-bold bg-background text-muted-foreground hover:text-foreground">
                    <span className="flex items-center gap-2"><Search size={12}/> Search Remittance Report...</span>
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[90vw] sm:w-[700px] p-0 shadow-2xl" align="start">
                <Command shouldFilter={false}>
                    <CommandInput placeholder="Type Invoice No. or Customer Name..." value={searchQuery} onValueChange={setSearchQuery} className="h-9 text-xs" />
                    <CommandList
                        className="max-h-[250px] overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-border hover:scrollbar-thumb-foreground/20"
                        onWheelCapture={(e) => e.stopPropagation()}
                        onTouchMoveCapture={(e) => e.stopPropagation()}
                    >
                        <CommandEmpty className="py-4 text-center text-xs text-muted-foreground">
                            {isSearching ? <span className="flex items-center justify-center gap-2"><Loader2 size={14} className="animate-spin"/> Searching...</span> : "No results."}
                        </CommandEmpty>
                        <CommandGroup heading={searchResults.length > 0 ? "Database Results" : ""}>
                            {searchResults.map((inv: UnpaidInvoice) => (
                                <CommandItem key={`search-${inv.id}`} onSelect={() => { addToCart(inv); setSearchOpen(false); }} className="flex justify-between items-center cursor-pointer py-2 px-3 border-b border-muted/50 last:border-0">
                                    <div className="flex flex-col"><span className="font-mono font-black text-primary text-xs">{inv.invoiceNo}</span><span className="text-[10px] text-muted-foreground font-medium leading-tight mt-0.5">{inv.customerName}</span></div>
                                    <span className="font-mono font-black text-emerald-600 text-sm">₱{inv.remainingBalance.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}