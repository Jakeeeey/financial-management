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
  subYears
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
  onWeekSelect: (weekStart: string) => void;
  availableWeeks?: { week_start: string; week_label: string }[];
}

export function WeekPicker({ selectedWeek, onWeekSelect, availableWeeks = [] }: WeekPickerProps) {
  const [viewDate, setViewDate] = React.useState(() => {
    if (selectedWeek && selectedWeek !== "all") {
      const d = new Date(selectedWeek);
      return isNaN(d.getTime()) ? new Date() : d;
    }
    return new Date();
  });
  const [mode, setMode] = React.useState<"month" | "week">("month");
  const [open, setOpen] = React.useState(false);

  // Sync viewDate when selectedWeek changes or popover opens
  React.useEffect(() => {
    if (open && selectedWeek && selectedWeek !== "all") {
      const d = new Date(selectedWeek);
      if (!isNaN(d.getTime())) {
        setViewDate(d);
        setMode("week");
      }
    }
  }, [open, selectedWeek]);

  const currentLabel = React.useMemo(() => {
    const found = availableWeeks.find(w => w.week_start === selectedWeek);
    return found ? found.week_label : "Select Review Period";
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
    onWeekSelect(id);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="outline" 
          className="w-[260px] h-10 rounded-xl font-black shadow-sm border-2 border-primary/10 bg-card hover:border-primary hover:text-primary-foreground transition-all flex items-center justify-between px-3 group"
        >
          <div className="flex items-center gap-2 text-xs">
            <CalendarDays className="h-3.5 w-3.5" />
            <span className="truncate">{currentLabel}</span>
          </div>
          <ChevronRight className="h-3.5 w-3.5 opacity-50 group-hover:opacity-100 transition-transform group-data-[state=open]:rotate-90" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0 rounded-2xl shadow-2xl border-none overflow-hidden bg-background" align="end">
        {/* Header */}
        <div className="p-4 flex items-start justify-between border-b bg-muted/10">
          <div>
            <h3 className="text-sm font-black tracking-tight text-foreground leading-none">Select Range</h3>
            <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mt-1">
              Auth List Filter
            </p>
          </div>
          <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full -mt-1 -mr-1" onClick={() => setOpen(false)}>
            <X className="h-3 w-3" />
          </Button>
        </div>

        <div className="p-3">
          {/* Navigation */}
          <div className="flex items-center justify-between mb-3 px-1">
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-7 w-7 rounded-lg hover:bg-muted" 
              onClick={() => setViewDate(mode === "month" ? subYears(viewDate, 1) : subMonths(viewDate, 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <button 
              className="text-[11px] font-black hover:text-primary transition-colors uppercase tracking-wider"
              onClick={() => setMode("month")}
            >
              {mode === "month" ? format(viewDate, "yyyy") : format(viewDate, "MMMM yyyy")}
            </button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-7 w-7 rounded-lg hover:bg-muted" 
              onClick={() => setViewDate(mode === "month" ? addYears(viewDate, 1) : addMonths(viewDate, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Month Mode */}
          {mode === "month" && (
            <div className="grid grid-cols-3 gap-1.5">
              {months.map((m) => (
                <button
                  key={m.getTime()}
                  onClick={() => handleMonthSelect(m)}
                  className={`
                    py-2 text-[10px] font-black rounded-xl transition-all
                    ${isSameMonth(m, viewDate) ? 'bg-primary text-primary-foreground shadow-md' : 'hover:bg-muted text-muted-foreground'}
                  `}
                >
                  {format(m, "MMM")}
                </button>
              ))}
            </div>
          )}

          {/* Week Mode */}
          {mode === "week" && (
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-2">
                {weeks.map((week) => {
                  const isSelected = selectedWeek === week.id;
                  const hasData = availableWeeks.some(aw => aw.week_start === week.id);
                  
                  return (
                    <button
                      key={week.id}
                      onClick={() => {
                        if (hasData) {
                          handleWeekSelect(week.id);
                        } else {
                          toast.warning(`No expense drafts found for ${week.label}.`, {
                            description: "Please select a week with available data.",
                            duration: 3000,
                          });
                        }
                      }}
                      className={`
                        relative flex flex-col items-center justify-center py-2.5 px-1 rounded-xl border transition-all
                        ${isSelected 
                          ? "bg-primary border-primary text-primary-foreground shadow-md" 
                          : "bg-muted/30 border-transparent hover:border-primary/20"}
                        ${!hasData ? "opacity-20 cursor-pointer" : "cursor-pointer"}
                      `}
                    >
                      <span className="text-[10px] font-black uppercase tracking-tighter leading-none">Week {week.number}</span>
                      <span className={`text-[8px] font-bold mt-1 leading-none ${isSelected ? 'text-primary-foreground/80' : 'text-muted-foreground/50'}`}>
                        {week.label.split(',')[0]}
                      </span>
                      {isSelected && <Check className="absolute top-1 right-1 h-2.5 w-2.5" />}
                    </button>
                  );
                })}
              </div>
              <Button 
                variant="link" 
                className="text-[9px] font-black uppercase tracking-widest text-primary h-4 p-0 mx-auto"
                onClick={() => setMode("month")}
              >
                Change Month
              </Button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
