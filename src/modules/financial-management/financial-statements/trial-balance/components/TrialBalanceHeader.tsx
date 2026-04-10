"use client";

import { Button } from "@/components/ui/button";
import { Download, RefreshCw } from "lucide-react";

export function TrialBalanceHeader() {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b pb-4 mb-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Trial Balance Review Report</h1>
        <p className="text-muted-foreground">
          Review header details, validate debit and credit totals, and drill into underlying journal entries.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Regenerate Report
        </Button>
        <Button className="gap-2 bg-primary text-primary-foreground">
          <Download className="h-4 w-4" />
          Export
        </Button>
      </div>
    </div>
  );
}
