"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import PricingMatrixView from "./components/PricingMatrixView";

export default function ProductPricingModule() {
    return (
        <Card className="rounded-2xl shadow-sm">
            <CardHeader className="pb-3">
                <CardTitle className="text-xl">Product Pricing</CardTitle>
            </CardHeader>
            <CardContent>
                <PricingMatrixView />
            </CardContent>
        </Card>
    );
}
