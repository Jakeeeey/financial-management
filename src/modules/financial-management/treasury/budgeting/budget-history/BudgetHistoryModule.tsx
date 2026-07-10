"use client";

import React from "react";
import { 
  History, 
  RefreshCw, 
  ChevronDown, 
  ChevronUp, 
  Loader2,
  Search,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { HISTORY_YEARS, HISTORY_MONTHS, HistoryNode } from "./constants";
import { HistoryHierarchyTable } from "./components/HistoryHierarchyTable";
import { budgetHistoryService } from "./services";

const ALL_FILTER_VALUE = "all";

export default function BudgetHistoryModule() {
  const [mounted, setMounted] = React.useState(false);
  const [selectedYear, setSelectedYear] = React.useState(new Date().getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = React.useState(HISTORY_MONTHS[new Date().getMonth()]);
  const [selectedBudgetNo, setSelectedBudgetNo] = React.useState("");
  const [selectedDivisionId, setSelectedDivisionId] = React.useState("");
  const [selectedDepartmentId, setSelectedDepartmentId] = React.useState("");
  const [selectedDeptDivId, setSelectedDeptDivId] = React.useState("");
  const [selectedCoaId, setSelectedCoaId] = React.useState("");
  const [divisions, setDivisions] = React.useState<{ id: string; name: string }[]>([]);
  const [departments, setDepartments] = React.useState<{ id: string; name: string; deptDivId: string }[]>([]);
  const [coas, setCoas] = React.useState<{ id: string; label: string }[]>([]);
  const [expandedKeys, setExpandedKeys] = React.useState<Set<string>>(new Set());
  const [nodes, setNodes] = React.useState<HistoryNode[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [errorMessage, setErrorMessage] = React.useState("");
  const requestSeqRef = React.useRef(0);
  const filterSelectClassName = "h-9 rounded-md text-xs font-medium border-input bg-background shadow-none px-3";

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
    const requestSeq = requestSeqRef.current + 1;
    requestSeqRef.current = requestSeq;
    setLoading(true);
    setErrorMessage("");
    try {
      const fetchedNodes = await budgetHistoryService.getHistoricalBudgets({
        year: selectedYear,
        month: selectedMonth,
        budget_no: selectedBudgetNo || undefined,
        division_id: selectedDivisionId || undefined,
        department_id: selectedDepartmentId || undefined,
        coa_id: selectedCoaId || undefined
      });
      if (requestSeq !== requestSeqRef.current) return;
      setNodes(fetchedNodes);
      setExpandedKeys(new Set(getAllIds(fetchedNodes)));
    } catch (err: unknown) {
      console.error("Failed to load real budget history data:", err);
      if (requestSeq === requestSeqRef.current) {
        setErrorMessage(err instanceof Error ? err.message : "Failed to load budget history records.");
      }
    } finally {
      if (requestSeq === requestSeqRef.current) {
        setLoading(false);
      }
    }
  }, [selectedYear, selectedMonth, selectedBudgetNo, selectedDivisionId, selectedDepartmentId, selectedCoaId, getAllIds]);

  React.useEffect(() => {
    setMounted(true);
    loadData();
  }, [loadData]);

  React.useEffect(() => {
    let cancelled = false;

    const loadDivisions = async () => {
      try {
        const fetchedDivisions = await budgetHistoryService.getDivisions();
        if (!cancelled) {
          setDivisions(fetchedDivisions);
        }
      } catch (err: unknown) {
        console.error("Failed to load budget history divisions:", err);
      }
    };

    loadDivisions();

    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    let cancelled = false;

    const loadDepartments = async () => {
      if (!selectedDivisionId) {
        setDepartments([]);
        return;
      }

      try {
        const fetchedDepartments = await budgetHistoryService.getDepartments(selectedDivisionId);
        if (!cancelled) {
          setDepartments(fetchedDepartments);
        }
      } catch (err: unknown) {
        console.error("Failed to load budget history departments:", err);
        if (!cancelled) {
          setDepartments([]);
        }
      }
    };

    loadDepartments();

    return () => {
      cancelled = true;
    };
  }, [selectedDivisionId]);

  React.useEffect(() => {
    let cancelled = false;

    const loadCoas = async () => {
      if (!selectedDeptDivId) {
        setCoas([]);
        return;
      }

      try {
        const fetchedCoas = await budgetHistoryService.getCOAs(selectedDeptDivId);
        if (!cancelled) {
          setCoas(fetchedCoas);
        }
      } catch (err: unknown) {
        console.error("Failed to load budget history COAs:", err);
        if (!cancelled) {
          setCoas([]);
        }
      }
    };

    loadCoas();

    return () => {
      cancelled = true;
    };
  }, [selectedDeptDivId]);

  const divisionOptions = React.useMemo(() => [
    { value: ALL_FILTER_VALUE, label: "All Divisions" },
    ...divisions.map(division => ({ value: division.id, label: division.name }))
  ], [divisions]);

  const departmentOptions = React.useMemo(() => [
    { value: ALL_FILTER_VALUE, label: "All Departments" },
    ...departments.map(department => ({ value: department.id, label: department.name }))
  ], [departments]);

  const coaOptions = React.useMemo(() => [
    { value: ALL_FILTER_VALUE, label: "All COA" },
    ...coas.map(coa => ({ value: coa.id, label: coa.label }))
  ], [coas]);

  const monthOptions = React.useMemo(() => (
    HISTORY_MONTHS.map(month => ({ value: month, label: month }))
  ), []);

  const yearOptions = React.useMemo(() => (
    HISTORY_YEARS.map(year => {
      const yearString = year.toString();
      return { value: yearString, label: yearString };
    })
  ), []);

  const handleDivisionChange = (value: string) => {
    setSelectedDivisionId(value === ALL_FILTER_VALUE ? "" : value);
    setSelectedDepartmentId("");
    setSelectedDeptDivId("");
    setSelectedCoaId("");
    setDepartments([]);
    setCoas([]);
  };

  const handleDepartmentChange = (value: string) => {
    if (value === ALL_FILTER_VALUE) {
      setSelectedDepartmentId("");
      setSelectedDeptDivId("");
      setSelectedCoaId("");
      setCoas([]);
      return;
    }

    const department = departments.find(item => item.id === value);
    setSelectedDepartmentId(value);
    setSelectedDeptDivId(department?.deptDivId || "");
    setSelectedCoaId("");
    setCoas([]);
  };

  const handleCoaChange = (value: string) => {
    setSelectedCoaId(value === ALL_FILTER_VALUE ? "" : value);
  };

  const resetFilters = () => {
    setSelectedBudgetNo("");
    setSelectedDivisionId("");
    setSelectedDepartmentId("");
    setSelectedDeptDivId("");
    setSelectedCoaId("");
    setSelectedMonth(HISTORY_MONTHS[new Date().getMonth()]);
    setSelectedYear(new Date().getFullYear().toString());
    setDepartments([]);
    setCoas([]);
  };

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

  const hasFilters = Boolean(
    selectedBudgetNo ||
    selectedDivisionId ||
    selectedDepartmentId ||
    selectedCoaId ||
    selectedMonth !== HISTORY_MONTHS[new Date().getMonth()] ||
    selectedYear !== new Date().getFullYear().toString()
  );

  if (!mounted) return null;

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 min-h-0 min-w-0 flex-1">
      {/* Header Section */}
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

      {/* Filter Section */}
      <Card className="rounded-2xl border-border/50 shadow-sm overflow-hidden">
        <CardContent className="p-4 bg-muted/20">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[180px] flex-1 max-w-xs">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <Input
                  id="budget-history-search"
                  type="search"
                  value={selectedBudgetNo}
                  onChange={(event) => setSelectedBudgetNo(event.target.value)}
                  placeholder="Search Budget No..."
                  className="h-9 pl-9 pr-8 text-xs"
                />
                {selectedBudgetNo ? (
                  <button
                    type="button"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setSelectedBudgetNo("")}
                    aria-label="Clear budget number search"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>

              <SearchableSelect
                options={monthOptions}
                value={selectedMonth}
                onValueChange={setSelectedMonth}
                placeholder="Month"
                className={`${filterSelectClassName} w-[120px] justify-between`}
              />

              <SearchableSelect
                options={yearOptions}
                value={selectedYear}
                onValueChange={setSelectedYear}
                placeholder="Year"
                className={`${filterSelectClassName} w-[110px] justify-between`}
              />

              <SearchableSelect
                options={divisionOptions}
                value={selectedDivisionId || ALL_FILTER_VALUE}
                onValueChange={handleDivisionChange}
                placeholder="Division"
                className={`${filterSelectClassName} w-[150px] justify-between`}
              />

              <SearchableSelect
                options={departmentOptions}
                value={selectedDepartmentId || ALL_FILTER_VALUE}
                onValueChange={handleDepartmentChange}
                placeholder="Department"
                disabled={!selectedDivisionId}
                className={`${filterSelectClassName} w-[160px] justify-between disabled:opacity-50`}
              />

              <SearchableSelect
                options={coaOptions}
                value={selectedCoaId || ALL_FILTER_VALUE}
                onValueChange={handleCoaChange}
                placeholder="COA"
                disabled={!selectedDepartmentId}
                className={`${filterSelectClassName} w-[220px] justify-between disabled:opacity-50`}
              />

              {hasFilters ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetFilters}
                  className="h-9 px-3 text-xs text-muted-foreground hover:text-foreground gap-1.5"
                >
                  <X className="h-3.5 w-3.5" />
                  Clear
                </Button>
              ) : null}
            </div>

            <div className="flex shrink-0 items-center justify-end">
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
        </CardContent>
      </Card>

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
        {errorMessage ? (
          <div className="mb-3 rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3">
            <p className="text-xs font-bold text-destructive">
              {errorMessage}
            </p>
          </div>
        ) : null}

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
