"use client";

import React from "react";
import { Skeleton } from "@/components/ui/skeleton";

export const CollectionLoading = () => {
    return (
        <div className="flex flex-col gap-6 p-4 md:p-6 max-w-[1600px] mx-auto w-full">
            {/* Header Skeleton */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-md" />
                    <div className="space-y-2">
                        <Skeleton className="h-5 w-48" />
                        <Skeleton className="h-4 w-32" />
                    </div>
                </div>
                <div className="flex gap-2">
                    <Skeleton className="h-9 w-24" />
                    <Skeleton className="h-9 w-24" />
                </div>
            </div>

            <Skeleton className="h-[1px] w-full" />

            {/* Date Range Skeleton */}
            <div className="flex items-center gap-3">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-9 w-[260px] rounded-full" />
                <Skeleton className="h-5 w-32 rounded-full" />
            </div>

            {/* KPIs Skeleton */}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
                {[...Array(6)].map((_, i) => (
                    <div key={i} className="border rounded-xl p-4 flex flex-col gap-3">
                        <div className="flex justify-between items-center">
                            <Skeleton className="h-3 w-20" />
                            <Skeleton className="h-4 w-4" />
                        </div>
                        <Skeleton className="h-[1px] w-full" />
                        <Skeleton className="h-7 w-24" />
                        <Skeleton className="h-3 w-32 mt-1" />
                    </div>
                ))}
            </div>

            {/* Charts Row 1 Skeleton */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <div className="xl:col-span-2 border rounded-xl h-[330px] p-5">
                    <Skeleton className="h-5 w-32 mb-2" />
                    <Skeleton className="h-4 w-48 mb-6" />
                    <Skeleton className="h-48 w-full" />
                </div>
                <div className="border rounded-xl h-[330px] p-5">
                    <Skeleton className="h-5 w-32 mb-2" />
                    <Skeleton className="h-4 w-48 mb-6" />
                    <div className="flex justify-center mb-6">
                        <Skeleton className="h-[140px] w-[140px] rounded-full" />
                    </div>
                    <Skeleton className="h-[2px] w-full mb-4" />
                    <div className="space-y-2">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-3/4" />
                    </div>
                </div>
            </div>

            {/* Payment Method Distribution Skeleton (Horizontal Bars) - Row 2 */}
            <div className="border rounded-xl h-[350px] p-5">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <Skeleton className="h-5 w-40 mb-2" />
                        <Skeleton className="h-4 w-56" />
                    </div>
                </div>
                <Skeleton className="h-[1px] w-full mb-4" />
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="space-y-4">
                        {[...Array(5)].map((_, i) => (
                             <div key={i} className="flex justify-between gap-4">
                                <Skeleton className="h-8 flex-1" />
                                <Skeleton className="h-8 w-24" />
                                <Skeleton className="h-8 w-12" />
                             </div>
                        ))}
                    </div>
                    <div className="flex flex-col gap-4">
                         {[...Array(5)].map((_, i) => (
                             <Skeleton key={i} className="h-8" style={{ width: `${100 - (i * 15)}%` }} />
                         ))}
                    </div>
                </div>
            </div>

            {/* Charts Row 3 Skeleton (Salesmen) */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <div className="border rounded-xl h-[350px] p-5">
                    <Skeleton className="h-5 w-32 mb-2" />
                    <Skeleton className="h-4 w-48 mb-6" />
                    <div className="flex flex-col gap-4">
                        <Skeleton className="h-6 w-full" />
                        <Skeleton className="h-6 w-[90%]" />
                        <Skeleton className="h-6 w-[85%]" />
                        <Skeleton className="h-6 w-[80%]" />
                        <Skeleton className="h-6 w-[75%]" />
                    </div>
                </div>
                <div className="border rounded-xl h-[350px] p-5">
                    <Skeleton className="h-5 w-32 mb-2" />
                    <Skeleton className="h-4 w-48 mb-6" />
                    <div className="space-y-4">
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                    </div>
                </div>
            </div>

            {/* Table Skeleton */}
            <div className="border rounded-xl h-[400px] p-5">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <Skeleton className="h-5 w-40 mb-2" />
                        <Skeleton className="h-4 w-56" />
                    </div>
                    <Skeleton className="h-6 w-20 rounded-full" />
                </div>
                <Skeleton className="h-[1px] w-full mb-4" />
                <div className="space-y-4">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                </div>
            </div>
        </div>
    );
};
