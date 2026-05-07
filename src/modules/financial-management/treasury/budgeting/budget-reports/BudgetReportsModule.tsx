"use client";

import React from "react";
import { BUDGET_REPORTS } from "./constants";
import { ReportCard } from "./components/ReportCard";
import { FileChartColumn, Search, RefreshCcw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function BudgetReportsModule() {
  const [search, setSearch] = React.useState("");

  const filteredReports = BUDGET_REPORTS.filter(r => 
    r.title.toLowerCase().includes(search.toLowerCase()) ||
    r.description.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 min-h-0 min-w-0 flex-1">
      {/* Header Section */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary/10 rounded-2xl">
            <FileChartColumn className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tighter uppercase leading-none">
              Budget Reports
            </h1>
            <p className="text-sm text-muted-foreground mt-1 font-medium">
              Generate and export financial insights and analytical data for budgeting.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input 
              placeholder="Search reports..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 rounded-xl bg-card border-border/50 text-xs font-medium"
            />
          </div>
          <Button variant="outline" size="sm" title="Refresh" className="h-9 w-9 p-0 rounded-xl border-border/50 active:scale-95 transition-transform">
            <RefreshCcw className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        </div>
      </div>

      {/* Reports Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredReports.map((report) => (
          <ReportCard key={report.id} report={report} />
        ))}
      </div>

      {filteredReports.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 bg-muted/20 rounded-3xl border border-dashed border-border/60">
          <FileChartColumn className="h-10 w-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm font-bold text-muted-foreground">No reports found matching your search.</p>
          <Button 
            variant="link" 
            onClick={() => setSearch("")}
            className="text-primary font-black uppercase text-[10px] tracking-widest mt-1"
          >
            Clear Search
          </Button>
        </div>
      )}
    </div>
  );
}
