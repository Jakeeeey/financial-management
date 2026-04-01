// tax-calendar/components/TaxCalendar.tsx
"use client";

import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useState, useMemo } from 'react';
import { STATUS_STYLE } from '../types';
import type { TaxActivity, TaxStatus } from '../types';

// Tax type badge colors — cycle through a set
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

  // Build stable tax type order for consistent coloring
  const allTypes = [...new Set(activities.map((a) => a.tax_type))].sort();

  // Build a map of dates to activities
  const activitiesByDate = useMemo(() => {
    const map = new Map<string, TaxActivity[]>();
    activities.forEach(a => {
      // Extract date directly from the string to avoid timezone issues
      const dateStr = a.due_date.split('T')[0] || a.due_date.split(' ')[0];
      if (!map.has(dateStr)) map.set(dateStr, []);
      map.get(dateStr)!.push(a);
    });
    return map;
  }, [activities]);

  // Get activities for selected date
  const selectedDateStr = selectedDate 
    ? selectedDate.toLocaleDateString('sv-SE') // Returns YYYY-MM-DD in local time
    : null;
  const activitiesForSelectedDate = selectedDateStr ? activitiesByDate.get(selectedDateStr) : null;

  return (
    <Card className="shadow-none border-border">
      <CardHeader className="border-b border-border/50 pb-3">
        <CardTitle className="text-sm font-bold uppercase">Tax Calendar</CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calendar — Fixed size */}
          <div className="lg:col-span-1 flex justify-center h-fit">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              className="rounded-md border border-border"
            />
          </div>

          {/* Selected date activities or empty state — Fixed height with scroll */}
          {selectedDate && (
            <div className="lg:col-span-2 h-80 flex flex-col border border-border rounded-lg p-4">
              {activitiesForSelectedDate && activitiesForSelectedDate.length > 0 ? (
                <div className="space-y-2 overflow-y-auto flex-1 pr-2">
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
              ) : (
                <div className="flex items-center justify-center text-center h-full">
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      No Tax record/s for this date
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
