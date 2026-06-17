"use client";

import React, { useRef } from "react";
import { LayoutDashboard, RefreshCw, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KPICards } from "./components/KPICards";
import { BudgetVsActualChart } from "./components/BudgetVsActualChart";
import { MonthlyTrendChart } from "./components/MonthlyTrendChart";
import { AllocationCategoryChart } from "./components/AllocationCategoryChart";
import { CriticalAlerts } from "./components/CriticalAlerts";
import { DepartmentPerformanceTable } from "./components/DepartmentPerformanceTable";
import { ExpenseCategoryHeatmap } from "./components/ExpenseCategoryHeatmap";
import { RecentDisbursementsFeed } from "./components/RecentDisbursementsFeed";
import { MonthOverMonthGrowthCard } from "./components/MonthOverMonthGrowthCard";
import { TopExpenseCategoriesCard } from "./components/TopExpenseCategoriesCard";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useBudgetDashboard } from "./hooks/useBudgetDashboard";
import { MONTH_NAMES } from "../budget-approval/utils";

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 11 }, (_, i) => String(CURRENT_YEAR - 5 + i));

export default function BudgetDashboardModule() {
  const { 
    filters, 
    updateFilter, 
    metrics, 
    trendData,
    categoryData,
    divisionComparison,
    departmentComparison,
    departmentCategoryMatrix,
    recentDisbursements,
    deptUtilization,
    pendingSummary,
    divisions,
    departments, 
    loading, 
    refresh 
  } = useBudgetDashboard();

  const [mounted, setMounted] = React.useState(false);
  const [currentTime, setCurrentTime] = React.useState("");
  const [drillDownDivision, setDrillDownDivision] = React.useState<{ id: string; name: string } | null>(null);
  const dashboardRef = useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    setMounted(true);
    const updateTime = () => {
      setCurrentTime(new Date().toLocaleString('en-PH', { 
        month: 'long', 
        day: 'numeric', 
        year: 'numeric',
        hour: '2-digit', 
        minute: '2-digit',
        second: '2-digit',
        hour12: true 
      }));
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleDivisionClick = (divisionName: string) => {
    const targetDiv = divisions.find(d => d.name === divisionName);
    if (targetDiv) {
      setDrillDownDivision(targetDiv);
      updateFilter("division_id", targetDiv.id);
    }
  };

  const handleBackToMain = () => {
    setDrillDownDivision(null);
    updateFilter("division_id", "");
  };

  // Handle interactive clicks on the Monthly Trend Chart
  const handleMonthClick = (monthNumber: string) => {
    updateFilter("month", monthNumber);
  };

  if (!mounted) return null;
  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 min-h-0 min-w-0 flex-1">
      {/* Header Section */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          {drillDownDivision ? (
            <Button 
              variant="outline" 
              size="icon" 
              className="h-10 w-10 rounded-2xl border-border/50 shrink-0"
              onClick={handleBackToMain}
              title="Back to Main Dashboard"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          ) : (
            <div className="p-2.5 bg-primary/10 rounded-2xl shrink-0">
              <LayoutDashboard className="h-6 w-6 text-primary" />
            </div>
          )}
          <div>
            <h1 className="text-2xl font-black tracking-tighter uppercase leading-none">
              {drillDownDivision ? `${drillDownDivision.name} Performance` : "Budget Dashboard"}
            </h1>
            <p className="text-sm text-muted-foreground mt-1 font-medium">
              {drillDownDivision ? `Viewing detailed metrics for ${drillDownDivision.name} division` : "Real-time analytics and financial performance tracking"}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Global Filters */}
          <div className="flex items-center gap-2 bg-muted/30 p-1.5 rounded-2xl border border-border/40">
            {!drillDownDivision && (
              <>
                <SearchableSelect 
                  className="h-8 w-44 rounded-xl text-[10px] font-black uppercase tracking-widest border-none bg-transparent hover:bg-white transition-colors shadow-none px-3"
                  value={filters.division_id || "all"} 
                  onValueChange={(val) => updateFilter("division_id", val === "all" ? "" : val)}
                  options={[
                    { value: "all", label: "ALL DIVISIONS" },
                    ...divisions.map(d => ({ value: d.id, label: d.name.toUpperCase() }))
                  ]}
                  placeholder="DIVISION"
                />
                <div className="h-4 w-px bg-border/60" />
              </>
            )}
            <SearchableSelect 
              className="h-8 w-48 rounded-xl text-[10px] font-black uppercase tracking-widest border-none bg-transparent hover:bg-white transition-colors disabled:opacity-50 shadow-none px-3"
              value={filters.department_id || "all"} 
              onValueChange={(val) => updateFilter("department_id", val === "all" ? "" : val)}
              disabled={!filters.division_id}
              options={[
                { value: "all", label: "ALL DEPARTMENTS" },
                ...departments.map(d => ({ value: d.id, label: d.name.toUpperCase() }))
              ]}
              placeholder="DEPARTMENT"
            />
            <div className="h-4 w-px bg-border/60" />
            
            <SearchableSelect
              className="h-8 w-28 rounded-xl text-[10px] font-black uppercase tracking-widest border-none bg-transparent hover:bg-white transition-colors shadow-none px-3"
              value={filters.month}
              onValueChange={(val) => updateFilter("month", val)}
              options={MONTH_NAMES.map((name, i) => ({
                value: String(i + 1),
                label: name.toUpperCase(),
              }))}
              placeholder="MONTH"
            />

            <SearchableSelect
              className="h-8 w-24 rounded-xl text-[10px] font-black uppercase tracking-widest border-none bg-transparent hover:bg-white transition-colors shadow-none px-3"
              value={filters.year}
              onValueChange={(val) => updateFilter("year", val)}
              options={YEARS.map(yr => ({ value: yr, label: yr }))}
              placeholder="YEAR"
            />
          </div>

          <div className="flex items-center gap-2">

            <Button
            size="sm"
            variant="outline"
            title="Refresh Data"
            onClick={refresh}
            disabled={loading}
            className="h-9 w-9 p-0 rounded-xl border-border/50 active:scale-95 transition-transform"
          >
            <RefreshCw className={`h-4 w-4 text-muted-foreground ${loading ? "animate-spin" : ""}`} />
          </Button>
          </div>
        </div>
      </div>

      {/* Real-time Timestamp */}
      <div className="flex items-center gap-2 px-1">
        <div className={`h-2 w-2 rounded-full ${loading ? "bg-amber-500 animate-bounce" : "bg-emerald-500 animate-pulse"}`} />
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">
          {loading ? "Updating..." : "Live Data"} <span className="mx-2 text-muted-foreground/30">|</span> As of {currentTime}
        </p>
      </div>

      {/* Bento Grid Layout */}
      <div ref={dashboardRef} className="flex flex-col gap-6 bg-background">
        {/* Row 1: KPI Cards */}
        <KPICards metrics={metrics} />

        {/* Row 2: Main Charts & Alerts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            {drillDownDivision ? (
              <ExpenseCategoryHeatmap data={departmentCategoryMatrix} />
            ) : (
              <MonthlyTrendChart data={trendData} onMonthClick={handleMonthClick} year={filters.year} />
            )}
          </div>
          <div className="lg:col-span-1">
            {drillDownDivision ? (
              <RecentDisbursementsFeed data={recentDisbursements} />
            ) : (
              <AllocationCategoryChart data={categoryData} />
            )}
          </div>
        </div>

        {/* Row 3: Detail Charts & Critical Alerts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            {drillDownDivision ? (
              <DepartmentPerformanceTable data={departmentComparison} />
            ) : (
              <BudgetVsActualChart 
                data={divisionComparison} 
                onDivisionClick={handleDivisionClick} 
                title="Budget vs Actual by Division"
              />
            )}
          </div>
          
          {drillDownDivision ? (
            <>
              <div className="lg:col-span-1">
                <MonthOverMonthGrowthCard trendData={trendData} currentMonthNumber={filters.month} divisionId={filters.division_id} />
              </div>
              <div className="lg:col-span-1">
                <TopExpenseCategoriesCard matrixData={departmentCategoryMatrix} />
              </div>
            </>
          ) : (
            <div className="lg:col-span-2">
              <CriticalAlerts 
                utilization={deptUtilization} 
                pending={pendingSummary} 
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
