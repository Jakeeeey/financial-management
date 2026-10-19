"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PriceTypeTable } from "./components/PriceTypeTable";
import { PriceTypeFormDialog } from "./components/PriceTypeFormDialog";
import { usePriceTypes } from "../product-pricing/hooks/usePriceTypes";
import { usePriceTypeActions } from "./hooks/usePriceTypeActions";
import type { PriceType } from "../product-pricing/types";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiHttpError } from "../shared/apiHttp";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type PriceTypeAction = "delete" | "deactivate" | "reactivate" | "deactivate-after-delete";

interface PendingPriceTypeAction {
    action: PriceTypeAction;
    priceType: PriceType;
    dependencyMessage?: string;
}

export function PriceTypeCreationModule() {
    const { loading, priceTypes, error } = usePriceTypes({ includeInactive: true });
    const { isPending, createPriceType, updatePriceType, deletePriceType } = usePriceTypeActions();

    const [dialogOpen, setDialogOpen] = React.useState(false);
    const [editingPT, setEditingPT] = React.useState<PriceType | null>(null);
    const [pendingAction, setPendingAction] = React.useState<PendingPriceTypeAction | null>(null);
    const actionInProgress = React.useRef(false);

    // Refresh function (hacky way without react-query but matches existing pattern)
    const refresh = () => window.location.reload();

    const handleCreate = () => {
        setEditingPT(null);
        setDialogOpen(true);
    };

    const handleEdit = (pt: PriceType) => {
        setEditingPT(pt);
        setDialogOpen(true);
    };

    const handleDelete = (priceType: PriceType) => {
        setPendingAction({ action: "delete", priceType });
    };

    const handleToggleActive = (priceType: PriceType) => {
        const active = priceType.is_active == null || priceType.is_active === true || priceType.is_active === 1 || priceType.is_active === "1";
        setPendingAction({ action: active ? "deactivate" : "reactivate", priceType });
    };

    const handleConfirmAction = async (event: React.MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();
        if (!pendingAction || actionInProgress.current) return;

        const currentAction = pendingAction;
        actionInProgress.current = true;

        try {
            if (currentAction.action === "delete") {
                try {
                    await deletePriceType(currentAction.priceType.price_type_id);
                } catch (error) {
                    const payload = error instanceof ApiHttpError &&
                        typeof error.payload === "object" && error.payload !== null
                        ? error.payload as { code?: string }
                        : null;

                    if (error instanceof ApiHttpError && payload?.code === "PRICE_TYPE_IN_USE") {
                        setPendingAction({
                            action: "deactivate-after-delete",
                            priceType: currentAction.priceType,
                            dependencyMessage: error.message,
                        });
                        return;
                    }

                    throw error;
                }
            } else {
                const isActive = currentAction.action === "reactivate";
                await updatePriceType(currentAction.priceType.price_type_id, { is_active: isActive });
            }

            setPendingAction(null);
            refresh();
        } catch {
            // The action hook already reports the request failure.
        } finally {
            actionInProgress.current = false;
        }
    };

    const handleSubmit = async (data: Partial<PriceType>) => {
        try {
            if (editingPT) {
                await updatePriceType(editingPT.price_type_id, data);
            } else {
                await createPriceType(data);
            }
            refresh();
        } catch {
            // The action hook already reports the request failure.
        }
    };

    if (loading) {
        return (
            <div className="space-y-4">
                <div className="flex justify-between items-center">
                    <Skeleton className="h-10 w-40 rounded-xl" />
                    <Skeleton className="h-10 w-32 rounded-xl" />
                </div>
                <Skeleton className="h-[400px] w-full rounded-2xl" />
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-semibold tracking-tight">Price Types</h2>
                    <p className="text-sm text-muted-foreground">
                        Manage price tiers used for product pricing.
                    </p>
                </div>
                <Button onClick={handleCreate} className="rounded-xl shadow-sm hover:shadow-md transition-all">
                    <Plus className="mr-2 h-4 w-4" />
                    New Price Type
                </Button>
            </div>

            {error && (
                <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium">
                    Error loading price types: {error}
                </div>
            )}

            <PriceTypeTable
                priceTypes={priceTypes}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onToggleActive={handleToggleActive}
            />

            <PriceTypeFormDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                onSubmit={handleSubmit}
                initialData={editingPT}
                isPending={isPending}
            />

            <AlertDialog
                open={pendingAction !== null}
                onOpenChange={(open) => {
                    if (!open && !isPending) setPendingAction(null);
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {pendingAction?.action === "delete"
                                ? "Delete price type?"
                                : pendingAction?.action === "deactivate-after-delete"
                                    ? "Price type is in use"
                                    : pendingAction?.action === "deactivate"
                                        ? "Deactivate price type?"
                                        : "Reactivate price type?"}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {pendingAction?.action === "delete"
                                ? `Delete “${pendingAction.priceType.price_type_name}”? This permanently removes the price type if it is not linked to existing records.`
                                : pendingAction?.action === "deactivate-after-delete"
                                    ? `${pendingAction.dependencyMessage} Would you like to deactivate “${pendingAction.priceType.price_type_name}” instead?`
                                    : pendingAction?.action === "deactivate"
                                        ? `Deactivate “${pendingAction.priceType.price_type_name}”? It will no longer be available for new price selections; existing records will remain unchanged.`
                                        : pendingAction
                                            ? `Reactivate “${pendingAction.priceType.price_type_name}”? It will become available for new price selections again.`
                                            : ""}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            variant={pendingAction?.action === "delete" ? "destructive" : "default"}
                            disabled={isPending || pendingAction === null}
                            onClick={(event) => void handleConfirmAction(event)}
                        >
                            {pendingAction?.action === "delete"
                                ? "Delete price type"
                                : pendingAction?.action === "deactivate-after-delete"
                                    ? "Deactivate instead"
                                    : pendingAction?.action === "deactivate"
                                        ? "Deactivate price type"
                                        : "Reactivate price type"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
