"use client";

import * as React from "react";
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  eachWeekOfInterval, 
  addMonths, 
  subMonths, 
  endOfWeek,
  isSameMonth,
  startOfYear,
  eachMonthOfInterval,
  addYears,
  subYears,
  startOfWeek
} from "date-fns";
import { ChevronLeft, ChevronRight, CalendarDays, X, Check } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface WeekPickerProps {
  selectedWeek: string; // yyyy-MM-dd
  onWeekSelect: (weekStart: string, weekEnd: string) => void;
  availableWeeks?: { week_start: string; week_label: string }[];
}

export function WeekPicker({ selectedWeek, onWeekSelect, availableWeeks }: WeekPickerProps) {
  const [viewDate, setViewDate] = React.useState(() => {
    if (selectedWeek) {
      const d = new Date(selectedWeek + "T00:00:00");
      return isNaN(d.getTime()) ? new Date() : d;
    }
    return new Date();
  });
  const [mode, setMode] = React.useState<"month" | "week">("month");
  const [open, setOpen] = React.useState(false);

  // Sync viewDate when selectedWeek changes or popover opens
  React.useEffect(() => {
    if (open && selectedWeek) {
      const d = new Date(selectedWeek + "T00:00:00");
      if (!isNaN(d.getTime())) {
        setViewDate(d);
        setMode("week");
      }
    }
  }, [open, selectedWeek]);

  const currentLabel = React.useMemo(() => {
    if (availableWeeks) {
      const found = availableWeeks.find(w => w.week_start === selectedWeek);
      if (found) return found.week_label;
    }
    
    // Fallback label if not in available weeks or not provided
    try {
      const start = new Date(selectedWeek);
      const end = endOfWeek(start, { weekStartsOn: 1 });
      return `${format(start, "MMM d")} - ${format(end, "d, yyyy")}`;
    } catch {
      return "Select Review Period";
    }
  }, [availableWeeks, selectedWeek]);

  const months = React.useMemo(() => {
    const start = startOfYear(viewDate);
    const end = endOfMonth(addMonths(start, 11));
    return eachMonthOfInterval({ start, end });
  }, [viewDate]);

  const weeks = React.useMemo(() => {
    const start = startOfMonth(viewDate);
    const end = endOfMonth(viewDate);
    const mondays = eachWeekOfInterval({ start, end }, { weekStartsOn: 1 });
    
    return mondays.map((monday, idx) => {
      const wEnd = endOfWeek(monday, { weekStartsOn: 1 });
      return {
        number: idx + 1,
        start: monday,
        end: wEnd,
        id: format(monday, "yyyy-MM-dd"),
        label: `${format(monday, "MMM d")} - ${format(wEnd, "d, yyyy")}`,
      };
    });
  }, [viewDate]);

  const handleMonthSelect = (month: Date) => {
    setViewDate(month);
    setMode("week");
  };

  const handleWeekSelect = (id: string) => {
    const start = id;
    const end = format(endOfWeek(new Date(id), { weekStartsOn: 1 }), "yyyy-MM-dd");
    onWeekSelect(start, end);
    setOpen(false);
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/50 mr-2">Review Period</span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button 
            variant="outline" 
            className="w-[260px] h-12 rounded-2xl font-black shadow-sm border-2 border-primary/10 bg-card hover:border-primary/40 hover:bg-muted/5 transition-all flex items-center justify-between px-4 group relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="flex items-center gap-3 text-xs relative z-10">
              <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/10 group-hover:scale-110 transition-transform">
                <CalendarDays className="h-4 w-4" />
              </div>
              <span className="truncate tracking-tight">{currentLabel}</span>
            </div>
            <ChevronRight className="h-4 w-4 opacity-30 group-hover:opacity-100 transition-all group-data-[state=open]:rotate-90 group-hover:translate-x-0.5 relative z-10" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-0 rounded-3xl shadow-2xl border-none overflow-hidden bg-background/95 backdrop-blur-xl" align="end" sideOffset={8}>
          {/* Header */}
          <div className="p-5 flex items-start justify-between border-b bg-muted/20">
            <div>
              <h3 className="text-base font-black tracking-tighter text-foreground leading-none">Select Range</h3>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1.5 opacity-60">
                Auth List Filter
              </p>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full -mt-1 -mr-1 hover:bg-muted/50" onClick={() => setOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="p-4">
            {/* Navigation */}
            <div className="flex items-center justify-between mb-4 px-1">
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 rounded-xl hover:bg-muted transition-colors" 
                onClick={() => setViewDate(mode === "month" ? subYears(viewDate, 1) : subMonths(viewDate, 1))}
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <button 
                className="text-xs font-black hover:text-primary transition-colors uppercase tracking-[0.15em] py-1 px-3 rounded-lg hover:bg-primary/5"
                onClick={() => setMode("month")}
              >
                {mode === "month" ? format(viewDate, "yyyy") : format(viewDate, "MMMM yyyy")}
              </button>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 rounded-xl hover:bg-muted transition-colors" 
                onClick={() => setViewDate(mode === "month" ? addYears(viewDate, 1) : addMonths(viewDate, 1))}
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>

            {/* Month Mode */}
            {mode === "month" && (
              <div className="grid grid-cols-3 gap-2 animate-in fade-in zoom-in-95 duration-200">
                {months.map((m) => (
                  <button
                    key={m.getTime()}
                    onClick={() => handleMonthSelect(m)}
                    className={`
                      py-3 text-[11px] font-black rounded-2xl transition-all relative overflow-hidden group
                      ${isSameMonth(m, viewDate) 
                        ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-105 z-10' 
                        : 'hover:bg-muted text-muted-foreground hover:scale-105'}
                    `}
                  >
                    <span className="relative z-10">{format(m, "MMM")}</span>
                    {isSameMonth(m, viewDate) && (
                      <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent opacity-50" />
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Week Mode */}
            {mode === "week" && (
              <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
                <div className="grid grid-cols-2 gap-3">
                  {weeks.map((week) => {
                    const isSelected = selectedWeek === week.id;
                    const hasData = availableWeeks ? availableWeeks.some(aw => aw.week_start === week.id) : true;
                    
                    return (
                      <button
                        key={week.id}
                        onClick={() => {
                          if (hasData) {
                            handleWeekSelect(week.id);
                          } else {
                            toast.warning(`No drafts found for ${week.label}.`, {
                              description: "Please select a week with active disbursements.",
                            });
                          }
                        }}
                        className={`
                          relative flex flex-col items-center justify-center py-3.5 px-2 rounded-2xl border-2 transition-all group
                          ${isSelected 
                            ? "bg-primary border-primary text-primary-foreground shadow-xl shadow-primary/20 scale-[1.02] z-10" 
                            : "bg-muted/20 border-transparent hover:border-primary/20 hover:bg-muted/40"}
                          ${!hasData ? "opacity-30 cursor-not-allowed" : "cursor-pointer"}
                        `}
                      >
                        <span className="text-[10px] font-black uppercase tracking-widest leading-none">Week {week.number}</span>
                        <span className={`text-[9px] font-bold mt-1.5 leading-none transition-opacity ${isSelected ? 'text-primary-foreground/70' : 'text-muted-foreground/40'}`}>
                          {week.label.split(',')[0]}
                        </span>
                        {isSelected && (
                          <div className="absolute top-2 right-2 h-4 w-4 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                            <Check className="h-2.5 w-2.5 text-white" strokeWidth={4} />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
                <Button 
                  variant="ghost" 
                  className="text-[10px] font-black uppercase tracking-[0.2em] text-primary h-8 rounded-xl hover:bg-primary/10 transition-colors"
                  onClick={() => setMode("month")}
                >
                  <ChevronLeft className="h-3.5 w-3.5 mr-1" />
                  Change Month
                </Button>
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
