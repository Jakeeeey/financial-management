"use client";

import React from "react";
import { 
  History, 
  RefreshCw, 
  ChevronDown, 
  ChevronUp, 
  Calendar,
  Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { HISTORY_YEARS, HISTORY_MONTHS, HistoryNode } from "./constants";
import { HistoryHierarchyTable } from "./components/HistoryHierarchyTable";
import { budgetHistoryService } from "./services";

export default function BudgetHistoryModule() {
  const [mounted, setMounted] = React.useState(false);
  const [selectedYear, setSelectedYear] = React.useState("2026");
  const [selectedMonth, setSelectedMonth] = React.useState("May");
  const [expandedKeys, setExpandedKeys] = React.useState<Set<string>>(new Set());
  const [nodes, setNodes] = React.useState<HistoryNode[]>([]);
  const [loading, setLoading] = React.useState(true);

  // Helper to recursively collect all node identifiers
  const getAllIds = React.useCallback((items: HistoryNode[]): string[] => {
    let ids: string[] = [];
    for (const node of items) {
      ids.push(node.id);
      if (node.children) {
        ids = [...ids, ...getAllIds(node.children)];
      }
    }
    return ids;
  }, []);

  const loadData = React.useCallback(async () => {
    setLoading(true);
    try {
      const fetchedNodes = await budgetHistoryService.getHistoricalBudgets({
        year: selectedYear,
        month: selectedMonth
      });
      setNodes(fetchedNodes);
      setExpandedKeys(new Set(getAllIds(fetchedNodes)));
    } catch (err: unknown) {
      console.error("Failed to load real budget history data:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedYear, selectedMonth, getAllIds]);

  React.useEffect(() => {
    setMounted(true);
    loadData();
  }, [loadData]);

  const toggleKey = (key: string) => {
    const newKeys = new Set(expandedKeys);
    if (newKeys.has(key)) {
      newKeys.delete(key);
    } else {
      newKeys.add(key);
    }
    setExpandedKeys(newKeys);
  };

  const openAll = () => {
    setExpandedKeys(new Set(getAllIds(nodes)));
  };

  const closeAll = () => {
    setExpandedKeys(new Set());
  };

  const totalBudget = React.useMemo(() => {
    return nodes.reduce((acc, node) => acc + node.budget, 0);
  }, [nodes]);

  if (!mounted) return null;

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 min-h-0 min-w-0 flex-1">
      {/* Header Section */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary/10 rounded-2xl">
            <History className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tighter uppercase leading-none">
              Budget History
            </h1>
            <p className="text-sm text-muted-foreground mt-1 font-medium">
              Explore historical budget allocations across multiple years and levels
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
           {/* Month & Year Selector Group */}
           <div className="flex items-center gap-2 bg-muted/30 p-1 rounded-2xl border border-border/40">
             <Calendar className="h-3.5 w-3.5 text-muted-foreground ml-2" />
             <Select value={selectedMonth} onValueChange={setSelectedMonth}>
               <SelectTrigger className="h-8 w-28 rounded-xl text-[10px] font-black uppercase tracking-widest border-none bg-transparent hover:bg-white transition-colors">
                 <SelectValue />
               </SelectTrigger>
               <SelectContent className="rounded-xl">
                 {HISTORY_MONTHS.map(month => (
                    <SelectItem key={month} value={month} className="text-[10px] font-bold">
                       {month}
                    </SelectItem>
                 ))}
               </SelectContent>
             </Select>
             <div className="h-4 w-px bg-border/60" />
             <Select value={selectedYear} onValueChange={setSelectedYear}>
               <SelectTrigger className="h-8 w-24 rounded-xl text-[10px] font-black uppercase tracking-widest border-none bg-transparent hover:bg-white transition-colors">
                 <SelectValue />
               </SelectTrigger>
               <SelectContent className="rounded-xl">
                 {HISTORY_YEARS.map(year => (
                    <SelectItem key={year} value={year.toString()} className="text-[10px] font-bold">
                       FY {year}
                    </SelectItem>
                 ))}
               </SelectContent>
             </Select>
           </div>
          
          <Button
            size="sm"
            variant="outline"
            onClick={loadData}
            disabled={loading}
            title="Refresh"
            className="h-9 w-9 p-0 rounded-xl border-border/50 active:scale-95 transition-transform"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 text-primary animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 text-muted-foreground" />
            )}
          </Button>
        </div>
      </div>

      {/* KPI Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
         <div className="md:col-span-1 p-6 rounded-3xl bg-primary text-primary-foreground shadow-xl shadow-primary/20 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
               <History className="h-20 w-20" />
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-70">Total Approved Budget</p>
            <h2 className="text-4xl font-black tracking-tighter mt-1">
               {new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 }).format(totalBudget)}
            </h2>
            <div className="mt-4 flex items-center gap-2">
               <span className="text-[10px] font-bold px-2 py-0.5 bg-white/20 rounded-full">
                  {selectedMonth} {selectedYear}
               </span>
            </div>
         </div>
      </div>

      {/* Toolbar / Expand Controls */}
      <div className="flex items-center justify-end">
         <div className="flex items-center gap-2">
            <Button 
              size="sm" 
              variant="outline" 
              onClick={openAll}
              className="h-9 px-3 text-[10px] font-black uppercase tracking-widest gap-2 rounded-xl border-border/50 hover:bg-primary/5 active:scale-95 transition-transform"
            >
               <ChevronDown className="h-3.5 w-3.5" />
               Open All
            </Button>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={closeAll}
              className="h-9 px-3 text-[10px] font-black uppercase tracking-widest gap-2 rounded-xl border-border/50 hover:bg-primary/5 active:scale-95 transition-transform"
            >
               <ChevronUp className="h-3.5 w-3.5" />
               Close All
            </Button>
         </div>
      </div>

      {/* Hierarchy Table Interface Container */}
      <div className="relative">
        {loading && (
          <div className="absolute inset-0 bg-background/50 backdrop-blur-[1px] z-10 flex items-center justify-center rounded-3xl transition-all">
            <div className="flex items-center gap-2 px-4 py-2 bg-card border border-border/50 shadow-lg rounded-2xl">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">Loading Records...</span>
            </div>
          </div>
        )}

        {nodes.length === 0 && !loading ? (
          <div className="p-12 text-center border border-border/40 rounded-3xl bg-card/50">
            <p className="text-sm font-bold text-muted-foreground">No approved budget history records found for this period.</p>
          </div>
        ) : (
          <HistoryHierarchyTable 
            data={nodes} 
            expandedKeys={expandedKeys} 
            toggleKey={toggleKey} 
          />
        )}
      </div>
    </div>
  );
}
