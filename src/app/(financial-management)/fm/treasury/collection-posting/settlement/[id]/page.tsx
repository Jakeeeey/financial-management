import React from "react";

// 🚀 IMPORT OUR NEW COMMAND CENTER COMPONENT
import SettlementCommandCenter from "@/modules/financial-management/treasury/collection/settlement/components/SettlementCommandCenter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 🚀 THE ACTUAL PAGE COMPONENT
export default async function SettlementCommandCenterPage(props: { params: Promise<{ id: string }> }) {
    // 1. Await the params to get the Pouch ID from the URL
    const params = await props.params;

    return (
        <div className="flex flex-col h-screen overflow-hidden bg-background">
            {/* 🚀 THE COMMAND CENTER NOW OWNS THE ENTIRE WINDOW */}
            <main className="flex-1 overflow-hidden">
                <SettlementCommandCenter params={{ id: params.id }} />
            </main>
        </div>
    );
}