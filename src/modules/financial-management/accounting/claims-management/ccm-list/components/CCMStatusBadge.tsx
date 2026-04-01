"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";

export function CCMStatusBadge({ status }: { status?: string | null }) {
    const s = (status ?? "").toUpperCase();

    if (s === "PENDING") return <Badge variant="outline">PENDING</Badge>;
    if (s === "FOR RECEIVING") return <Badge variant="secondary">FOR RECEIVING</Badge>;
    if (s === "FOR PAYMENT") return <Badge variant="default">FOR PAYMENT</Badge>;
    if (s === "POSTED") return <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white border-transparent">POSTED</Badge>;
    if (s === "CANCEL" || s === "CANCELLED") return <Badge variant="destructive">CANCEL</Badge>;

    if (!s) return <Badge variant="outline">—</Badge>;

    return <Badge variant="outline">{s}</Badge>;
}
