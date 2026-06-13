"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { AlertCircle, Loader2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";

import { PcrTypeTabList } from "./components/PcrTypeTabs";
import { UnifiedApprovalsManager } from "./components/UnifiedApprovalsManager";
import { PriceTypeRequestManager } from "./components/PriceTypeRequestManager";
import { ListCostRequestManager } from "./components/ListCostRequestManager";
import { SessionExpiredPanel } from "../shared/SessionExpiredPanel";
import { isUnauthorizedError } from "../shared/apiHttp";

import { getSuppliers, SupplierOption } from "./providers/pcrApi";
import type { ApprovalTypeFilter, ListQuery } from "./types";
import { cn } from "@/lib/utils";

const DEFAULT_SHARED_QUERY: ListQuery = {
    status: "ALL",
    supplier_ids: [],
    page: 1,
    page_size: 50,
};

export function PriceChangeRequestsModule() {
    const [suppliers, setSuppliers] = React.useState<SupplierOption[]>([]);
    const [suppliersLoading, setSuppliersLoading] = React.useState(true);
    const [suppliersError, setSuppliersError] = React.useState<string | null>(null);
    const [sessionExpired, setSessionExpired] = React.useState(false);
    const [typeTab, setTypeTab] = React.useState<ApprovalTypeFilter>("all");
    const [sharedQuery, setSharedQuery] = React.useState<ListQuery>(DEFAULT_SHARED_QUERY);
    const [mountedTabs, setMountedTabs] = React.useState(() => new Set<ApprovalTypeFilter>(["all"]));

    const handleUnauthorized = React.useCallback(() => {
        setSessionExpired(true);
    }, []);

    const loadSuppliers = React.useCallback(async () => {
        setSuppliersLoading(true);
        try {
            const res = await getSuppliers();
            setSuppliers(res.suppliers);
            setSuppliersError(null);
        } catch (error: unknown) {
            if (isUnauthorizedError(error)) {
                setSessionExpired(true);
                setSuppliers([]);
                setSuppliersError(null);
                return;
            }

            const message = error instanceof Error ? error.message : "Failed to load suppliers";
            setSuppliers([]);
            setSuppliersError(message);
            toast.error(message);
        } finally {
            setSuppliersLoading(false);
        }
    }, []);

    React.useEffect(() => {
        void loadSuppliers();
    }, [loadSuppliers]);

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
        return (
            <div className="space-y-3">
                <SessionExpiredPanel returnPath="/fm/price-control/price-change-requests" />
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <Card className="rounded-2xl">
                <CardHeader className="flex flex-row items-center justify-between gap-3">
                    <div className="space-y-1">
                        <CardTitle>Price Change Approvals</CardTitle>
                        <div className="text-sm text-muted-foreground">
                            Approve or reject price updates.
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="space-y-4">
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
                </CardContent>
            </Card>
        </div>
    );
}
