"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { AlertCircle, Loader2 } from "lucide-react";
import * as React from "react";

import { SessionExpiredPanel } from "../../shared/SessionExpiredPanel";
import { usePCRSuppliers } from "../hooks/usePCRSuppliers";
import type { ApprovalTypeFilter, ListQuery } from "../types";
import { cn } from "@/lib/utils";
import { ListCostRequestManager } from "./ListCostRequestManager";
import { PcrTypeTabList } from "./PcrTypeTabs";
import { PriceTypeRequestManager } from "./PriceTypeRequestManager";
import { UnifiedApprovalsManager } from "./UnifiedApprovalsManager";

const DEFAULT_SHARED_QUERY: ListQuery = {
    status: "ALL",
    supplier_ids: [],
    page: 1,
    page_size: 50,
};

export default function PriceChangeRequestsView() {
    const {
        suppliers,
        suppliersLoading,
        suppliersError,
        sessionExpired,
        loadSuppliers,
        handleUnauthorized,
    } = usePCRSuppliers();

    const [typeTab, setTypeTab] = React.useState<ApprovalTypeFilter>("all");
    const [sharedQuery, setSharedQuery] = React.useState<ListQuery>(DEFAULT_SHARED_QUERY);
    const [mountedTabs, setMountedTabs] = React.useState(() => new Set<ApprovalTypeFilter>(["all"]));

    React.useEffect(() => {
        setSharedQuery((q) => ({ ...q, page: 1 }));
    }, [typeTab]);

    React.useEffect(() => {
        setMountedTabs((prev) => {
            if (prev.has(typeTab)) return prev;
            const next = new Set(prev);
            next.add(typeTab);
            return next;
        });
    }, [typeTab]);

    const supplierLookupProps = {
        suppliers,
        suppliersLoading,
        suppliersError,
    };

    if (sessionExpired) {
        return <SessionExpiredPanel returnPath="/fm/price-control/price-change-requests" />;
    }

    return (
        <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Approve or reject price updates.</p>

            {suppliersError ? (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Suppliers could not be loaded</AlertTitle>
                    <AlertDescription className="space-y-3">
                        <p>{suppliersError}</p>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => void loadSuppliers()}
                            disabled={suppliersLoading}
                        >
                            {suppliersLoading ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : null}
                            Retry
                        </Button>
                    </AlertDescription>
                </Alert>
            ) : null}

            <Tabs
                value={typeTab}
                onValueChange={(value) => setTypeTab(value as ApprovalTypeFilter)}
            >
                <PcrTypeTabList />

                {mountedTabs.has("all") ? (
                    <TabsContent
                        forceMount
                        value="all"
                        className={cn(typeTab !== "all" && "hidden")}
                    >
                        <UnifiedApprovalsManager
                            {...supplierLookupProps}
                            query={sharedQuery}
                            setQuery={setSharedQuery}
                            onUnauthorized={handleUnauthorized}
                            active={typeTab === "all"}
                        />
                    </TabsContent>
                ) : null}

                {mountedTabs.has("price") ? (
                    <TabsContent
                        forceMount
                        value="price"
                        className={cn(typeTab !== "price" && "hidden")}
                    >
                        <PriceTypeRequestManager
                            {...supplierLookupProps}
                            query={sharedQuery}
                            setQuery={setSharedQuery}
                            onUnauthorized={handleUnauthorized}
                            active={typeTab === "price"}
                        />
                    </TabsContent>
                ) : null}

                {mountedTabs.has("cost") ? (
                    <TabsContent
                        forceMount
                        value="cost"
                        className={cn(typeTab !== "cost" && "hidden")}
                    >
                        <ListCostRequestManager
                            {...supplierLookupProps}
                            query={sharedQuery}
                            setQuery={setSharedQuery}
                            onUnauthorized={handleUnauthorized}
                            active={typeTab === "cost"}
                        />
                    </TabsContent>
                ) : null}
            </Tabs>
        </div>
    );
}
