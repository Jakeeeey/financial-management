"use client";

import React from "react";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  FileText, 
  Download, 
  FileSpreadsheet, 
  ChevronRight,
  PieChart,
  LayoutDashboard,
  BarChart3,
  Activity,
  History,
  ClipboardCheck,
  Calendar
} from "lucide-react";
import { BudgetReportDef } from "../constants";

const iconMap: Record<string, any> = {
  PieChart,
  LayoutDashboard,
  BarChart3,
  Activity,
  History,
  ClipboardCheck
};

interface ReportCardProps {
  report: BudgetReportDef;
}

export function ReportCard({ report }: ReportCardProps) {
  const Icon = iconMap[report.icon] || FileText;

  return (
    <Card className="group relative flex flex-col h-full border-border/50 bg-card hover:shadow-xl hover:border-primary/20 transition-all duration-300 rounded-2xl overflow-hidden">
      {/* Decorative Gradient Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

      <CardHeader className="relative pb-4">
        <div className="flex items-start justify-between">
          <div className="p-2.5 bg-primary/10 rounded-xl group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300">
            <Icon className="h-5 w-5" />
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 group-hover:text-primary transition-colors">
            {report.category}
          </span>
        </div>
        <div className="mt-4 space-y-1.5">
          <CardTitle className="text-base font-black tracking-tight leading-tight group-hover:text-primary transition-colors">
            {report.title}
          </CardTitle>
          <CardDescription className="text-xs leading-relaxed line-clamp-2 text-muted-foreground/80">
            {report.description}
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent className="relative flex-1 pb-6 space-y-4">
        <div className="space-y-1.5">
          <label className="text-[10px] font-black uppercase text-muted-foreground/60 ml-1 tracking-widest flex items-center gap-1.5">
            <Calendar className="h-3 w-3" />
            Reporting Period
          </label>
          <Select defaultValue="month">
            <SelectTrigger className="h-10 rounded-xl bg-muted/30 border-border/40 text-xs font-bold focus:ring-primary/20">
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="month" className="text-xs font-medium">Current Month</SelectItem>
              <SelectItem value="quarter" className="text-xs font-medium">Current Quarter</SelectItem>
              <SelectItem value="year" className="text-xs font-medium">Current Year</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button className="w-full h-10 rounded-xl text-xs font-black uppercase tracking-tight gap-2 shadow-md hover:shadow-lg active:scale-[0.98] transition-all">
          <FileText className="h-3.5 w-3.5" />
          Generate Report
        </Button>
      </CardContent>

      <CardFooter className="relative pt-0 border-t border-border/40 bg-muted/5 flex flex-col gap-3 p-4 mt-auto">
        <div className="flex gap-2 w-full">
          <Button variant="outline" size="sm" className="flex-1 h-9 rounded-xl text-[10px] font-bold gap-2 border-border/60 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all">
            <Download className="h-3.5 w-3.5" />
            PDF
          </Button>
          <Button variant="outline" size="sm" className="flex-1 h-9 rounded-xl text-[10px] font-bold gap-2 border-border/60 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200 transition-all">
            <FileSpreadsheet className="h-3.5 w-3.5" />
            EXCEL
          </Button>
        </div>
        <div className="flex items-center justify-between w-full px-1">
          <p className="text-[9px] text-muted-foreground/60 font-medium">
            Last generated: <span className="font-bold">May 7, 2026</span>
          </p>
          <ChevronRight className="h-3 w-3 text-muted-foreground/30" />
        </div>
      </CardFooter>
    </Card>
  );
}
