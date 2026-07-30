// CalendarDayCell.tsx
import React from 'react';
import { CalendarDayData } from '../types';
import { cn } from '@/lib/utils';
import { formatPeso } from '../../accounts-receivable/utils';

interface CalendarDayCellProps {
  dayData: CalendarDayData;
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  onClick: () => void;
}

export function CalendarDayCell({
  dayData,
  isCurrentMonth,
  isToday,
  isSelected,
  onClick,
}: CalendarDayCellProps) {
  const { date, totalExpected, statusDots, intensity } = dayData;
  const dayNum = date.getDate();

  // Color dots mapping
  const getDotColorClass = (status: string) => {
    switch (status) {
      case 'kept':
        return 'bg-emerald-500';
      case 'broken':
        return 'bg-rose-500';
      case 'rescheduled':
        return 'bg-amber-500';
      default:
        return 'bg-blue-500';
    }
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        "relative flex flex-col justify-between p-2 h-20 border border-border/40 text-left transition-all hover:bg-muted/50 cursor-pointer w-full min-w-0 select-none",
        !isCurrentMonth && "opacity-35 hover:bg-transparent pointer-events-none",
        isToday && "ring-1 ring-purple-600 shadow-sm",
        isSelected && "bg-purple-500/10 border-purple-500/50"
      )}
      style={{
        // Dynamically style background according to heat intensity
        backgroundColor: intensity > 0 && isCurrentMonth
          ? `rgba(147, 51, 234, ${intensity * 0.15})`
          : undefined
      }}
    >
      <div className="flex justify-between items-center w-full">
        <span className={cn(
          "text-xs font-bold",
          isToday ? "text-purple-600 dark:text-purple-400 font-extrabold" : "text-muted-foreground"
        )}>
          {dayNum}
        </span>
        {isToday && (
          <span className="h-1.5 w-1.5 rounded-full bg-purple-600 animate-ping absolute top-2 right-2" />
        )}
      </div>

      {isCurrentMonth && totalExpected > 0 && (
        <div className="flex flex-col gap-0.5 mt-auto w-full overflow-hidden">
          <span className="text-[10px] font-black tracking-tight text-foreground truncate">
            {formatPeso(totalExpected)}
          </span>
          <div className="flex gap-0.5 items-center flex-wrap max-w-full">
            {statusDots.map((dot, idx) => (
              <div
                key={idx}
                className={cn("h-1.5 w-1.5 rounded-full shrink-0", getDotColorClass(dot.status))}
                title={`${dot.count} ${dot.status}`}
              />
            ))}
          </div>
        </div>
      )}
    </button>
  );
}
