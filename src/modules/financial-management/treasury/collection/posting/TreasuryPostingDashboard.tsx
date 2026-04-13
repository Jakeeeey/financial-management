"use client";

import React, { useState, useMemo } from "react";
import { Loader2, Layers } from "lucide-react";
import { usePosting } from "./hooks/usePosting";
import { Header } from "./components/Header";
import { QueueTable } from "./components/QueueTable";
import { ReviewSheet } from "./components/ReviewSheet";
import { Button } from "@/components/ui/button";

interface TreasuryPostingDashboardProps {
    currentUser: {
        name: string;
        email: string;
        avatar: string;
        id: string;
    };
}

export default function TreasuryPostingDashboard({ currentUser }: TreasuryPostingDashboardProps) {
    const {
        queue, isLoading, isPosting, refreshQueue,
        selectedPouch, isLoadingDetails, isReviewSheetOpen, setIsReviewSheetOpen,
        openReviewSheet, handlePostPouch
    } = usePosting();

    // 🚀 NEW: State for the active operation tab
    const [activeOperationTab, setActiveOperationTab] = useState<string>("All");

    // 🚀 NEW: Dynamically extract unique operations from the queue
    const uniqueOperations = useMemo(() => {
        const ops = new Set(queue.map(item => item.operationName));
        return Array.from(ops).sort();
    }, [queue]);

    // 🚀 NEW: Filter the queue based on the selected tab
    const filteredQueue = useMemo(() => {
        if (activeOperationTab === "All") return queue;
        return queue.filter(item => item.operationName === activeOperationTab);
    }, [queue, activeOperationTab]);

    if (isLoading) {
        return (
            <div className="p-10 flex flex-col items-center justify-center text-muted-foreground min-h-[50vh] gap-4">
                <Loader2 className="animate-spin" size={32} />
                <span className="font-black uppercase tracking-widest text-xs">Loading Audit Queue...</span>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            <Header onRefresh={refreshQueue} />

            {/* 🚀 NEW: DYNAMIC OPERATIONS TABS */}
            {queue.length > 0 && (
                <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-thin">
                    <div className="flex items-center gap-2 text-muted-foreground pr-2 border-r border-border shrink-0">
                        <Layers size={16} />
                        <span className="text-[10px] font-black uppercase tracking-widest">Filter by Operation:</span>
                    </div>

                    <Button
                        variant={activeOperationTab === "All" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setActiveOperationTab("All")}
                        className="rounded-full h-8 text-xs font-bold tracking-wide shrink-0 transition-all"
                    >
                        All Operations ({queue.length})
                    </Button>

                    {uniqueOperations.map(operation => {
                        const count = queue.filter(q => q.operationName === operation).length;
                        return (
                            <Button
                                key={operation}
                                variant={activeOperationTab === operation ? "default" : "outline"}
                                size="sm"
                                onClick={() => setActiveOperationTab(operation)}
                                className={`rounded-full h-8 text-xs font-bold tracking-wide shrink-0 transition-all ${
                                    activeOperationTab !== operation ? 'bg-background hover:bg-muted text-muted-foreground' : ''
                                }`}
                            >
                                {operation} ({count})
                            </Button>
                        );
                    })}
                </div>
            )}

            {/* Pass the FILTERED queue to the table instead of the raw queue */}
            <QueueTable
                queue={filteredQueue}
                onReview={openReviewSheet}
            />

            <ReviewSheet
                isOpen={isReviewSheetOpen}
                onOpenChange={setIsReviewSheetOpen}
                isLoading={isLoadingDetails}
                pouch={selectedPouch}
                isPosting={isPosting}
                onPost={handlePostPouch}
            />
        </div>
    );
}