"use client";

import React from "react";
import { Plus, Search, Filter, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCashiering } from "./hooks/useCashiering";
import CashieringSheet from "./components/CashieringSheet";
import CashieringMasterList from "./components/CashieringMasterList";
import { CurrentUser } from "../types";;

interface ModuleProps {
    currentUser: CurrentUser;
}

export default function CollectionCashieringModule({ currentUser }: ModuleProps) {
    const state = useCashiering(currentUser);

    return (
        <div className="flex flex-col gap-6 w-full max-w-7xl mx-auto animate-in fade-in duration-500">

            {/* Action Bar */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">
                        Collection Cashiering
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        Receive and manage physical remittance pouches.
                    </p>
                </div>
                <Button
                    onClick={() => {
                        // 🚀 Ensure we start fresh for a new pouch
                        state.resetForm();
                        state.setIsSheetOpen(true);
                    }}
                    className="gap-2 shadow-md bg-primary hover:bg-primary/90"
                >
                    <Plus size={16} /> Receive New Pouch
                </Button>
            </div>

            {/* Filter Bar */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-card p-3 rounded-lg border border-border shadow-sm">
                <div className="relative w-full md:w-96">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        type="text"
                        placeholder="Search by CP number or salesman..."
                        className="pl-9 h-9 bg-background"
                    />
                </div>
                <div className="flex items-center gap-2 w-full md:w-auto">
                    <Button variant="outline" size="sm" className="h-9 gap-2">
                        <Filter size={14} /> Filter
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-9 w-9 p-0"
                        onClick={() => window.location.reload()}
                    >
                        <RefreshCcw size={14} className={state.isLoading ? "animate-spin" : ""} />
                    </Button>
                </div>
            </div>

            {/* 🚀 THE MASTER LIST (Now with state passed for Edit logic) */}
            <CashieringMasterList
                data={state.masterList}
                isLoading={state.isLoading}
                state={state}
            />

            <CashieringSheet state={state} />

        </div>
    );
}