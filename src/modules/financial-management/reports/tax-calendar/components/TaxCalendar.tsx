// tax-calendar/components/TaxCalendar.tsx
"use client";

import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useState, useMemo } from 'react';
import { STATUS_STYLE } from '../types';
import type { TaxActivity } from '../types';

const TYPE_COLORS = [
  'bg-violet-50 text-violet-700 border-violet-200',
  'bg-sky-50 text-sky-700 border-sky-200',
  'bg-teal-50 text-teal-700 border-teal-200',
  'bg-amber-50 text-amber-700 border-amber-200',
  'bg-rose-50 text-rose-700 border-rose-200',
  'bg-indigo-50 text-indigo-700 border-indigo-200',
  'bg-emerald-50 text-emerald-700 border-emerald-200',
  'bg-orange-50 text-orange-700 border-orange-200',
  'bg-pink-50 text-pink-700 border-pink-200',
];

function getTaxTypeColor(taxType: string, allTypes: string[]): string {
  const idx = allTypes.indexOf(taxType);
  return TYPE_COLORS[idx % TYPE_COLORS.length];
}

interface Props {
  activities: TaxActivity[];
}

export function TaxCalendarView({ activities }: Props) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());

  const allTypes = [...new Set(activities.map((a) => a.tax_type))].sort();

  const activitiesByDate = useMemo(() => {
    const map = new Map<string, TaxActivity[]>();
    activities.forEach(a => {
      const dateStr = a.due_date.split('T')[0] || a.due_date.split(' ')[0];
      if (!map.has(dateStr)) map.set(dateStr, []);
      map.get(dateStr)!.push(a);
    });
    return map;
  }, [activities]);

  const selectedDateStr = selectedDate
    ? selectedDate.toLocaleDateString('sv-SE')
    : null;
  const activitiesForSelectedDate = selectedDateStr ? activitiesByDate.get(selectedDateStr) : null;

  // Custom day renderer to show red dot on dates with activities
  const modifiers = useMemo(() => {
    const datesWithActivity: Date[] = [];
    activitiesByDate.forEach((_, dateStr) => {
      const [year, month, day] = dateStr.split('-').map(Number);
      datesWithActivity.push(new Date(year, month - 1, day));
    });
    return { hasActivity: datesWithActivity };
  }, [activitiesByDate]);

  const modifiersClassNames = {
    hasActivity: 'has-activity',
  };

  return (
    <Card className="shadow-none border-border">
      <CardHeader className="border-b border-border/50 pb-3">
        <CardTitle className="text-sm font-bold uppercase">Tax Calendar</CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Calendar — full width, larger */}
          <div className="flex justify-center">
            <style>{`
              /* Make calendar fill its container */
              .tax-calendar-root {
                width: 100% !important;
              }
              .tax-calendar-root table {
                width: 100% !important;
              }
              /* Bigger day cells */
              .tax-calendar-root .rdp-day {
                width: 100% !important;
                height: 56px !important;
                font-size: 0.9rem !important;
                position: relative;
              }
              .tax-calendar-root .rdp-head_cell {
                font-size: 0.8rem !important;
                padding-bottom: 8px !important;
              }
              .tax-calendar-root .rdp-caption_label {
                font-size: 1rem !important;
                font-weight: 600 !important;
              }
              /* Red dot for days with activities */
              .tax-calendar-root .has-activity::after {
                content: '';
                position: absolute;
                bottom: 6px;
                left: 50%;
                transform: translateX(-50%);
                width: 5px;
                height: 5px;
                border-radius: 50%;
                background-color: #ef4444;
              }
              /* Keep dot visible even when day is selected */
              .tax-calendar-root .rdp-day_selected.has-activity::after {
                background-color: #fca5a5;
              }
            `}</style>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              modifiers={modifiers}
              modifiersClassNames={modifiersClassNames}
              className="rounded-md border border-border tax-calendar-root w-full"
            />
          </div>

          {/* Selected date activities */}
          <div className="h-[420px] flex flex-col border border-border rounded-lg p-4">
            {selectedDate ? (
              activitiesForSelectedDate && activitiesForSelectedDate.length > 0 ? (
                <>
                  <p className="text-xs font-semibold text-muted-foreground mb-3 shrink-0">
                    {selectedDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    <span className="ml-2 text-foreground">· {activitiesForSelectedDate.length} record{activitiesForSelectedDate.length > 1 ? 's' : ''}</span>
                  </p>
                  <div className="space-y-2 overflow-y-auto flex-1 pr-1">
                    {activitiesForSelectedDate.map(activity => (
                      <div
                        key={activity.id}
                        className="bg-background border border-border rounded-lg p-3 space-y-1.5 hover:bg-muted/30 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-xs text-foreground truncate">
                              {activity.title}
                            </p>
                            {activity.description && (
                              <p className="text-[11px] text-muted-foreground truncate">
                                {activity.description}
                              </p>
                            )}
                          </div>
                          <Badge variant="outline" className={`text-[10px] font-semibold whitespace-nowrap ${STATUS_STYLE[activity.status]}`}>
                            {activity.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${getTaxTypeColor(activity.tax_type, allTypes)}`}>
                            {activity.tax_type}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center text-center h-full">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">No tax records for</p>
                    <p className="text-sm font-medium text-foreground">
                      {selectedDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                </div>
              )
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-sm text-muted-foreground">Select a date to view records</p>
              </div>
            )}
          </div>

        </div>
      </CardContent>
    </Card>
  );
}