"use client";

import * as React from "react";
import { toast } from "sonner";
import { Download, FileDown, Printer, LayoutGrid, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";

import { cn } from "@/lib/utils";
import { 
  JournalEntry, 
  JournalEntryGroup, 
  AnalyticsSummary, 
  FilterState 
} from "./types";
import { useJournalEntries } from "./hooks/useJournalEntries";
import { JournalEntryProvider } from "./providers/JournalEntryProvider";

import SummaryCards from "./components/SummaryCards";
import FilterPanel from "./components/FilterPanel";
import JournalEntryTable from "./components/JournalEntryTable";
import JournalEntryDetailModal from "./components/JournalEntryDetailModal";
import { exportJournalToExcel, exportJournalToPdf } from "./services/export.service";

import { DataTableSkeleton } from "@/app/(financial-management)/fm/_components/DataTableSkeleton";
import { ErrorPage } from "@/app/(financial-management)/fm/_components/ErrorPage";

/**
 * Main module component that provides the context for all sub-components.
 * Follows the standard Provider Pattern for consistent state management.
 */
export default function JournalEntryModule() {
  return (
    <JournalEntryProvider>
      <JournalEntryDashboard />
    </JournalEntryProvider>
  );
}

function JournalEntryDashboard() {
  const { 
    groups, 
    paginatedGroups,
    analytics, 
    filters, 
    setFilters, 
    uniqueSourceModules,
    isLoading, 
    error, 
    refresh,
    resetFilters,
    currentPage,
    pageSize,
    pageCount,
    totalGroupCount,
    setCurrentPage,
    setPageSize,
  } = useJournalEntries();

  const [selectedGroup, setSelectedGroup] = React.useState<JournalEntryGroup | null>(null);
  const [isDetailOpen, setIsDetailOpen] = React.useState(false);

  const handleExport = (type: "PDF" | "Excel") => {
    const dateRangeText = `${filters.startDate} to ${filters.endDate}`;
    try {
      if (type === "Excel") {
        exportJournalToExcel(groups, dateRangeText, "General_Journal_Export.xlsx");
        toast.success("Excel exported successfully!");
      } else {
        exportJournalToPdf(groups, dateRangeText, "General_Journal_Export.pdf");
        toast.success("PDF exported successfully!");
      }
    } catch (err) {
      toast.error(`Failed to export ${type}`);
    }
  };

  if (error) {
    return <ErrorPage message={error} onRefresh={refresh} />;
  }

  return (
    <div className="flex flex-col h-full bg-muted/10 overflow-hidden">
      {/* Header Section */}
      <div className="bg-background px-6 py-4 border-b flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0 shadow-sm">
        <div>
          <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
             Journal Entry Analysis
             <Badge variant="secondary" className="text-[10px] uppercase font-bold py-0 h-4">Analytics Dashboard</Badge>
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Real-time audit, validation, and multi-line accounting distribution tracking.
          </p>
        </div>
        <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-9 text-xs" onClick={() => handleExport("PDF")}>
                <Printer className="mr-2 h-3.5 w-3.5" />
                Export PDF
            </Button>
            <Button size="sm" className="h-9 text-xs shadow-md" onClick={() => handleExport("Excel")}>
                <FileDown className="mr-2 h-3.5 w-3.5" />
                Export Excel
            </Button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden p-6 gap-6 min-h-0">
        {/* Left Filter Panel */}
        <FilterPanel 
            filters={filters} 
            setFilters={setFilters} 
            uniqueSourceModules={uniqueSourceModules}
            onReset={resetFilters} 
        />

        {/* Right Content Area */}
        <div className="flex-1 overflow-y-auto space-y-6 pr-1 custom-scrollbar">
          {/* Summary Stats */}
          <SummaryCards data={analytics} />



          {/* Grouped Table with Loading State */}
          {isLoading ? (
              <DataTableSkeleton columnCount={9} rowCount={10} />
          ) : (
              <JournalEntryTable 
                groups={paginatedGroups} 
                loading={isLoading}
                onDrillDown={(g) => {
                    setSelectedGroup(g);
                    setIsDetailOpen(true);
                }}
                currentPage={currentPage}
                pageSize={pageSize}
                pageCount={pageCount}
                totalGroupCount={totalGroupCount}
                onPageChange={setCurrentPage}
                onPageSizeChange={setPageSize}
              />
          )}
        </div>
      </div>

      <JournalEntryDetailModal 
        group={selectedGroup}
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
      />
    </div>
  );
}

// Inline Badge for local use if UI component is not globally exposed in index
function Badge({ variant = "default", className = "", children }: any) {
    const variants: any = {
        default: "bg-primary text-primary-foreground",
        secondary: "bg-secondary text-secondary-foreground",
        outline: "border border-input bg-background",
    };
    return (
        <span className={cn(
            "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
            variants[variant],
            className
        )}>
            {children}
        </span>
    );
}
