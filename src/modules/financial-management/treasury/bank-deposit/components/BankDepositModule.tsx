"use client";

import React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { History, PlusCircle, Landmark } from "lucide-react";
import { useBankDeposit } from "../hooks/useBankDeposit";
import { PrepareDepositTab } from "./PrepareDepositTab";
import { DepositLedgerTab } from "./DepositLedgerTab";

export function BankDepositModule() {
    const hookData = useBankDeposit();

    return (
        <div className="p-4 sm:p-8 space-y-6 max-w-[1600px] mx-auto">
            <div>
                <h1 className="text-3xl font-black uppercase flex items-center gap-3"><Landmark className="text-primary h-8 w-8" /> Treasury Bank Deposit</h1>
                <p className="text-muted-foreground font-bold text-sm uppercase mt-1">Manage vault assets and reconcile bank statements</p>
            </div>

            <Tabs defaultValue="prepare" className="w-full">
                <div className="border-b mb-6">
                    <TabsList className="bg-transparent h-12 gap-6">
                        <TabsTrigger value="prepare" className="data-[state=active]:border-b-2 border-primary rounded-none h-full font-bold uppercase text-xs">
                            <PlusCircle size={16} className="mr-2"/> Prepare Deposit
                        </TabsTrigger>
                        <TabsTrigger value="history" className="data-[state=active]:border-b-2 border-primary rounded-none h-full font-bold uppercase text-xs">
                            <History size={16} className="mr-2"/> Deposit Ledger
                        </TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="prepare">
                    <PrepareDepositTab
                        vaultAssets={hookData.vaultAssets}
                        activeBanks={hookData.activeBanks}
                        isLoading={hookData.isLoading}
                        isSubmitting={hookData.isSubmitting}
                        onPrepare={hookData.prepareDeposit}
                        fetchData={hookData.fetchVaultAndBanks}
                    />
                </TabsContent>

                <TabsContent value="history">
                    <DepositLedgerTab
                        history={hookData.history}
                        isLoading={hookData.isLoading}
                        isSubmitting={hookData.isSubmitting}
                        onClear={hookData.clearDeposit}
                        fetchData={hookData.fetchHistory}
                    />
                </TabsContent>
            </Tabs>
        </div>
    );
}