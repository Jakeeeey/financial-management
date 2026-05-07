"use client";

import React from "react";
import { LayoutDashboard, RefreshCw, Filter, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KPICards } from "./components/KPICards";
import { BudgetVsActualChart } from "./components/BudgetVsActualChart";
import { MonthlyTrendChart } from "./components/MonthlyTrendChart";
import { AllocationCategoryChart } from "./components/AllocationCategoryChart";
import { CriticalAlerts } from "./components/CriticalAlerts";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";

export default function BudgetDashboardModule() {
  const [currentTime, setCurrentTime] = React.useState("");

  React.useEffect(() => {
    setCurrentTime(new Date().toLocaleString('en-PH', { 
      month: 'long', 
      day: 'numeric', 
      year: 'numeric',
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit',
      hour12: true 
    }));
    
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleString('en-PH', { 
        month: 'long', 
        day: 'numeric', 
        year: 'numeric',
        hour: '2-digit', 
        minute: '2-digit',
        second: '2-digit',
        hour12: true 
      }));
    }, 1000);

    return () => clearInterval(timer);
  }, []);
  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 min-h-0 min-w-0 flex-1">
      {/* Header Section */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary/10 rounded-2xl">
            <LayoutDashboard className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tighter uppercase leading-none">
              Budget Dashboard
            </h1>
            <p className="text-sm text-muted-foreground mt-1 font-medium">
              Real-time analytics and financial performance tracking
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Global Filters */}
          <div className="flex items-center gap-2 bg-muted/30 p-1.5 rounded-2xl border border-border/40">
            <Select defaultValue="all">
              <SelectTrigger className="h-8 w-32 rounded-xl text-[10px] font-black uppercase tracking-widest border-none bg-transparent hover:bg-white transition-colors">
                <SelectValue placeholder="Division" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all" className="text-[10px] font-bold uppercase">All Divisions</SelectItem>
                <SelectItem value="industrial" className="text-[10px] font-bold uppercase">Industrial</SelectItem>
                <SelectItem value="corporate" className="text-[10px] font-bold uppercase">Corporate</SelectItem>
                <SelectItem value="logistics" className="text-[10px] font-bold uppercase">Logistics</SelectItem>
              </SelectContent>
            </Select>
            <div className="h-4 w-px bg-border/60" />
            <Select defaultValue="may">
              <SelectTrigger className="h-8 w-28 rounded-xl text-[10px] font-black uppercase tracking-widest border-none bg-transparent hover:bg-white transition-colors">
                <SelectValue placeholder="Month" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="may" className="text-[10px] font-bold uppercase">May 2026</SelectItem>
                <SelectItem value="june" className="text-[10px] font-bold uppercase">June 2026</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            size="sm"
            variant="outline"
            title="Refresh Data"
            className="h-9 w-9 p-0 rounded-xl border-border/50 active:scale-95 transition-transform"
          >
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
          </Button>
        </div>
      </div>

      {/* Real-time Timestamp */}
      <div className="flex items-center gap-2 px-1">
        <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">
          Live Data <span className="mx-2 text-muted-foreground/30">|</span> As of {currentTime}
        </p>
      </div>

      {/* Bento Grid Layout */}
      <div className="flex flex-col gap-6">
        {/* Row 1: KPI Cards */}
        <KPICards />

        {/* Row 2: Main Charts & Alerts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <MonthlyTrendChart />
          </div>
          <div className="lg:col-span-1">
            <AllocationCategoryChart />
          </div>
        </div>

        {/* Row 3: Detail Charts & Critical Alerts */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-1">
            <BudgetVsActualChart />
          </div>
          <div className="lg:col-span-3">
             <CriticalAlerts />
          </div>
        </div>
      </div>
    </div>
  );
}
