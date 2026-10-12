"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { updateMemo } from "../service";
import {
    ChartOfAccount,
    Customer,
    MemoApprovalRow,
    Salesman,
    Supplier,
} from "../types";
import { HeaderForm } from "./HeaderForm";

interface CustomerMemoEditDialogProps {
    memo: MemoApprovalRow | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    suppliers: Supplier[];
    customers: Customer[];
    salesmen: Salesman[];
    coas: ChartOfAccount[];
    onSaved: () => void;
}

export function CustomerMemoEditDialog({
    memo,
    open,
    onOpenChange,
    suppliers,
    customers,
    salesmen,
    coas,
    onSaved,
}: CustomerMemoEditDialogProps) {
    const [selectedSupplier, setSelectedSupplier] = useState("");
    const [selectedCustomer, setSelectedCustomer] = useState("");
    const [selectedSalesman, setSelectedSalesman] = useState("");
    const [selectedCOA, setSelectedCOA] = useState("");
    const [amount, setAmount] = useState(0);
    const [reason, setReason] = useState("");
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!open || !memo) return;
        setSelectedSupplier(String(memo.supplier_id?.id ?? ""));
        setSelectedCustomer(String(memo.customer_id?.id ?? ""));
        setSelectedSalesman(String(memo.salesman_id?.id ?? ""));
        setSelectedCOA(String(memo.chart_of_account?.coa_id ?? ""));
        setAmount(Number(memo.amount) || 0);
        setReason(memo.reason || "");
    }, [memo, open]);

    const editSuppliers = useMemo(() => {
        const id = memo?.supplier_id?.id;
        if (!id || suppliers.some((supplier) => supplier.id === id)) return suppliers;
        return [...suppliers, {
            id,
            supplier_name: memo?.supplier_id?.supplier_name || "Current supplier",
            supplier_shortcut: "",
        }];
    }, [memo, suppliers]);

    const editCustomers = useMemo(() => {
        const customer = memo?.customer_id;
        if (!customer || customers.some((option) => option.id === customer.id)) return customers;
        return [...customers, {
            id: customer.id,
            customer_name: customer.customer_name || "Current customer",
            customer_code: "",
            store_name: customer.store_name,
            brgy: customer.brgy,
            city: customer.city,
            province: customer.province,
        }];
    }, [customers, memo]);

    const editSalesmen = useMemo(() => {
        const salesman = memo?.salesman_id;
        if (!salesman || salesmen.some((option) => option.id === salesman.id)) return salesmen;
        return [...salesmen, {
            id: salesman.id,
            salesman_name: salesman.salesman_name || "Current salesman",
            salesman_code: salesman.salesman_code || "",
        }];
    }, [memo, salesmen]);

    const editCOAs = useMemo(() => {
        const coa = memo?.chart_of_account;
        if (!coa || coas.some((option) => option.coa_id === coa.coa_id)) return coas;
        return [...coas, {
            coa_id: coa.coa_id,
            gl_code: coa.gl_code || "",
            account_title: coa.account_title || "Current account",
            balance_type: 1,
        }];
    }, [coas, memo]);

    const handleSave = async () => {
        if (!memo || saving) return;

        const supplierId = Number(selectedSupplier);
        const customerId = Number(selectedCustomer);
        const salesmanId = Number(selectedSalesman);
        const coaId = Number(selectedCOA);
        if (
            !Number.isInteger(supplierId) || supplierId <= 0
            || !Number.isInteger(customerId) || customerId <= 0
            || !Number.isInteger(salesmanId) || salesmanId <= 0
            || !Number.isInteger(coaId) || coaId <= 0
        ) {
            toast.error("Select a supplier, customer, salesman, and chart of account.");
            return;
        }
        if (!Number.isFinite(amount) || amount <= 0) {
            toast.error("Memo amount must be greater than zero.");
            return;
        }

        setSaving(true);
        try {
            const result = await updateMemo(memo.id, {
                supplier_id: supplierId,
                customer_id: customerId,
                salesman_id: salesmanId,
                chart_of_account: coaId,
                amount,
                reason,
            });
            if (!result?.success) {
                toast.error(result?.error || "Customer memo update failed.");
                return;
            }

            toast.success("Customer credit memo updated.");
            onOpenChange(false);
            onSaved();
        } catch {
            toast.error("Network error while updating the customer memo.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-[calc(100vw-2rem)] max-h-[90vh] max-w-7xl overflow-y-auto sm:max-w-7xl">
                <DialogHeader>
                    <DialogTitle>Edit Customer Credit Memo</DialogTitle>
                    <DialogDescription>
                        Update the memo header while it is pending approval. The memo number, type, and linked transactions remain unchanged.
                    </DialogDescription>
                </DialogHeader>

                <HeaderForm
                    suppliers={editSuppliers}
                    customers={editCustomers}
                    salesmen={editSalesmen}
                    coas={editCOAs}
                    selectedSupplier={selectedSupplier}
                    onSupplierChange={setSelectedSupplier}
                    selectedCustomer={selectedCustomer}
                    onCustomerChange={setSelectedCustomer}
                    selectedSalesman={selectedSalesman}
                    onSalesmanChange={setSelectedSalesman}
                    selectedCOA={selectedCOA}
                    onCOAChange={setSelectedCOA}
                    balanceType={1}
                    onBalanceTypeChange={() => undefined}
                    amount={amount}
                    onAmountChange={setAmount}
                    memoNumber={memo?.memo_number || ""}
                    reason={reason}
                    onReasonChange={setReason}
                    allowMemoTypeChange={false}
                    dropdownWithinDialog
                />

                <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                        Cancel
                    </Button>
                    <Button type="button" onClick={handleSave} disabled={saving || !memo}>
                        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Save Changes
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
