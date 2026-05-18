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
  PieChart,
  LayoutDashboard,
  BarChart3,
  Activity,
  History,
  ClipboardCheck
} from "lucide-react";
import { BudgetReportDef } from "../constants";
import { PdfTemplate } from "@/components/pdf-layout-design/services/pdf-template";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  PieChart,
  LayoutDashboard,
  BarChart3,
  Activity,
  History,
  ClipboardCheck
};

interface ReportCardProps {
  report: BudgetReportDef;
  templates: PdfTemplate[];
  onPreview: (id: string, title: string, templateName: string) => void;
  onDownload: (id: string, title: string, templateName: string) => void;
  onExcel: (id: string, title: string) => void;
}

export function ReportCard({ report, templates, onPreview, onDownload, onExcel }: ReportCardProps) {
  const [selectedTemplate, setSelectedTemplate] = React.useState<string>("");
  const Icon = iconMap[report.icon] || FileText;

  // Set default template once loaded
  React.useEffect(() => {
    if (templates.length > 0 && !selectedTemplate) {
      const standard = templates.find(t => t.name.toLowerCase().includes("standard")) || templates[0];
      setSelectedTemplate(standard.name);
    }
  }, [templates, selectedTemplate]);

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

      <CardContent className="relative flex-1 pb-6 space-y-5">
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase text-muted-foreground/60 ml-1 tracking-widest">Select Layout Template</label>
          <Select 
            value={selectedTemplate} 
            onValueChange={setSelectedTemplate}
          >
            <SelectTrigger className="w-full h-10 rounded-xl text-[10px] font-bold uppercase tracking-widest bg-muted/40 border-none hover:bg-muted/60 transition-colors">
              <SelectValue placeholder="Select Layout" />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-border/40 shadow-2xl">
              {templates.length > 0 ? (
                templates.map(t => (
                  <SelectItem key={t.id} value={t.name} className="text-[10px] font-bold uppercase tracking-widest">
                    {t.name}
                  </SelectItem>
                ))
              ) : (
                <SelectItem value="loading" disabled className="text-[10px] font-bold uppercase">
                  Loading Layouts...
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>

        <Button 
          onClick={() => onPreview(report.id, report.title, selectedTemplate)}
          className="w-full h-11 rounded-xl text-xs font-black uppercase tracking-tight gap-2 shadow-md hover:shadow-lg active:scale-[0.98] transition-all bg-primary/10 text-primary hover:bg-primary hover:text-white"
        >
          <FileText className="h-3.5 w-3.5" />
          Preview Report
        </Button>
      </CardContent>

      <CardFooter className="relative pt-4 border-t border-border/40 bg-muted/5 flex p-4 mt-auto">
        <div className="flex gap-2 w-full">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => onDownload(report.id, report.title, selectedTemplate)}
            className="flex-1 h-9 rounded-xl text-[10px] font-bold gap-2 border-border/60 hover:bg-red-50 hover:text-red-600 hover:border-red-200 active:scale-95 transition-all"
          >
            <Download className="h-3.5 w-3.5" />
            PDF
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => onExcel(report.id, report.title)}
            className="flex-1 h-9 rounded-xl text-[10px] font-bold gap-2 border-border/60 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200 active:scale-95 transition-all"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            EXCEL
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
