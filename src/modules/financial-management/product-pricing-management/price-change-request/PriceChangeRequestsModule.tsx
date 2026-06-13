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

import { getLookups, SupplierOption } from "./providers/pcrApi";
import type { ApprovalTypeFilter, ListQuery } from "./types";

const DEFAULT_SHARED_QUERY: ListQuery = {
    status: "ALL",
    page: 1,
    page_size: 50,
};

export function PriceChangeRequestsModule() {
    const [suppliers, setSuppliers] = React.useState<SupplierOption[]>([]);
    const [suppliersLoading, setSuppliersLoading] = React.useState(true);
    const [suppliersError, setSuppliersError] = React.useState<string | null>(null);
    const [typeTab, setTypeTab] = React.useState<ApprovalTypeFilter>("all");
    const [sharedQuery, setSharedQuery] = React.useState<ListQuery>(DEFAULT_SHARED_QUERY);

    const loadSuppliers = React.useCallback(async () => {
        setSuppliersLoading(true);
        try {
            const res = await getLookups();
            setSuppliers(res.suppliers);
            setSuppliersError(null);
        } catch (error: unknown) {
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

    const supplierLookupProps = {
        suppliers,
        suppliersLoading,
        suppliersError,
    };

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

                        <TabsContent value="all">
                            <UnifiedApprovalsManager
                                {...supplierLookupProps}
                                query={sharedQuery}
                                setQuery={setSharedQuery}
                            />
                        </TabsContent>

                        <TabsContent value="price">
                            <PriceTypeRequestManager
                                {...supplierLookupProps}
                                query={sharedQuery}
                                setQuery={setSharedQuery}
                            />
                        </TabsContent>

                        <TabsContent value="cost">
                            <ListCostRequestManager
                                {...supplierLookupProps}
                                query={sharedQuery}
                                setQuery={setSharedQuery}
                            />
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>
        </div>
    );
}
