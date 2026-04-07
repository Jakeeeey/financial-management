// src/modules/financial-management/treasury/salesmen-expense-approval/components/DateRangePicker.tsx
"use client";

import * as React from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon, X } from "lucide-react";
import { DateRange } from "react-day-picker";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface Props extends React.HTMLAttributes<HTMLDivElement> {
  date: DateRange | undefined;
  setDate: (date: DateRange | undefined) => void;
}

export function DateRangePicker({ date, setDate, className }: Props) {
  return (
    <div className={cn("inline-block", className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={"outline"}
            className={cn(
              "w-[260px] justify-start text-left font-bold rounded-full border-2 hover:border-primary/50 transition-all shadow-sm",
              !date && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
            <span className="truncate text-xs">
              {date?.from ? (
                date.to ? (
                  <>
                    {format(date.from, "LLL dd, y")} - {format(date.to, "LLL dd, y")}
                  </>
                ) : (
                  format(date.from, "LLL dd, y")
                )
              ) : (
                <span>Pick a date range</span>
              )}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 rounded-2xl shadow-2xl border-2" align="end">
          <div className="p-4 border-b bg-muted/20 flex items-center justify-between">
            <div>
              <h4 className="font-black text-sm tracking-tight">Select Date Range</h4>
              <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest">
                Pending Auth list filter
              </p>
            </div>
            {date && (
                <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 rounded-full hover:bg-destructive/10 hover:text-destructive transition-colors"
                    onClick={() => setDate(undefined)}
                >
                    <X className="h-4 w-4" />
                </Button>
            )}
          </div>
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={date?.from}
            selected={date}
            onSelect={setDate}
            numberOfMonths={1}
            className="p-3"
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
