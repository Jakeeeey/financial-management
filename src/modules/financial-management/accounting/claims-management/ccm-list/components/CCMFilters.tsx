//src/modules/financial-management-system/claims-management/ccm-list/components/CCMFilters.tsx
"use client";

import * as React from "react";
import type { CCMListQuery } from "../utils/types";
import { searchCustomers, searchSuppliers } from "../providers/lookupsService";

import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Search } from "lucide-react";

import { AsyncCombobox } from "./AsyncCombobox";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

type Props = {
    query: CCMListQuery;
    onChange: (patch: Partial<CCMListQuery>) => void;
    onReset: () => void;
};

const STATUS_OPTIONS = [
    { value: "PENDING", label: "PENDING" },
    { value: "FOR RECEIVING", label: "FOR RECEIVING" },
    { value: "FOR PAYMENT", label: "FOR PAYMENT" },
    { value: "POSTED", label: "POSTED" },
];

export function CCMFilters({ query, onChange, onReset }: Props) {
    const hasActive =
        !!query.q || !!query.status || !!query.supplier_id || !!query.customer_id;

    const [supplierLabel, setSupplierLabel] = React.useState<string | null>(null);
    const [customerLabel, setCustomerLabel] = React.useState<string | null>(null);

    function handleReset() {
        setSupplierLabel(null);
        setCustomerLabel(null);
        onReset();
    }

    return (
        <div className="space-y-3">
            {/* Layout: search wider, others balanced */}
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
                {/* Search */}
                <div className="lg:col-span-5">
                    <Label className="text-xs text-muted-foreground">Search</Label>
                    <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            className="pl-9"
                            placeholder="Memo # or Reason…"
                            value={query.q ?? ""}
                            onChange={(e) => onChange({ q: e.target.value, page: 1 })}
                        />
                    </div>
                </div>

                {/* Status */}
                <div className="lg:col-span-2">
                    <Label className="text-xs text-muted-foreground">Status</Label>
                    <Select
                        value={query.status ?? ""}
                        onValueChange={(v) =>
                            onChange({ status: v === "__all__" ? "" : v, page: 1 })
                        }
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Any status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="__all__">Any status</SelectItem>
                            {STATUS_OPTIONS.map((o) => (
                                <SelectItem key={o.value} value={o.value}>
                                    {o.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {/* Supplier */}
                <div className="lg:col-span-3">
                    <Label className="text-xs text-muted-foreground">Supplier</Label>
                    <AsyncCombobox
                        valueId={query.supplier_id ? Number(query.supplier_id) : null}
                        valueLabel={supplierLabel}
                        placeholder="Any supplier"
                        searchPlaceholder="Type supplier name…"
                        onChange={(next) => {
                            if (!next) {
                                setSupplierLabel(null);
                                onChange({ supplier_id: "", page: 1 });
                                return;
                            }
                            setSupplierLabel(next.label);
                            onChange({ supplier_id: String(next.id), page: 1 });
                        }}
                        fetchItems={async (q, signal) => {
                            const rows = await searchSuppliers(q, signal);
                            return rows.map((r) => ({ id: r.id, label: r.label }));
                        }}
                    />
                </div>

                {/* Customer */}
                <div className="lg:col-span-2">
                    <Label className="text-xs text-muted-foreground">Customer</Label>
                    <AsyncCombobox
                        valueId={query.customer_id ? Number(query.customer_id) : null}
                        valueLabel={customerLabel}
                        placeholder="Any customer"
                        searchPlaceholder="Type customer name/code…"
                        onChange={(next) => {
                            if (!next) {
                                setCustomerLabel(null);
                                onChange({ customer_id: "", page: 1 });
                                return;
                            }
                            setCustomerLabel(next.label);
                            onChange({ customer_id: String(next.id), page: 1 });
                        }}
                        fetchItems={async (q, signal) => {
                            const rows = await searchCustomers(q, signal);
                            return rows.map((r) => ({ id: r.id, label: r.label }));
                        }}
                    />
                </div>
            </div>

            {/* Footer row */}
            <div className="flex flex-wrap items-center gap-2">
                {hasActive ? (
                    <>
                        <Badge variant="secondary" className="text-xs">
                            Filters active
                        </Badge>
                        <Button type="button" variant="ghost" onClick={handleReset}>
                            <X className="mr-2 h-4 w-4" />
                            Reset
                        </Button>
                    </>
                ) : (
                    <Badge variant="outline" className="text-xs">
                        No filters
                    </Badge>
                )}
            </div>
        </div>
    );
}
