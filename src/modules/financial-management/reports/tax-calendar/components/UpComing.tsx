// tax-calendar/components/UpcomingBanner.tsx
"use client";
import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CalendarDays } from 'lucide-react';
import { daysUntil } from '../utils';
import type { TaxActivity } from '../types';

interface Props { upcoming: TaxActivity[] }

type AlertFilter = 'all' | '7days' | '3days' | 'today' | 'overdue';

export function UpcomingBanner({ upcoming }: Props) {
  const [filter, setFilter] = useState<AlertFilter>('all');

  const filtered = useMemo(() => {
    return upcoming.filter(a => {
      const days = daysUntil(a.due_date);
      switch (filter) {
        case '7days':
          return days > 3 && days <= 7;
        case '3days':
          return days > 0 && days <= 3;
        case 'today':
          return days === 0;
        case 'overdue':
          return days < 0;
        default:
          return true;
      }
    });
  }, [upcoming, filter]);

  if (upcoming.length === 0) return null;

  const counts = {
    all: upcoming.length,
    '7days': upcoming.filter(a => { const d = daysUntil(a.due_date); return d > 3 && d <= 7; }).length,
    '3days': upcoming.filter(a => { const d = daysUntil(a.due_date); return d > 0 && d <= 3; }).length,
    'today': upcoming.filter(a => daysUntil(a.due_date) === 0).length,
    'overdue': upcoming.filter(a => daysUntil(a.due_date) < 0).length,
  };

  return (
    <Card className="shadow-none border-yellow-200 dark:border-yellow-900 bg-yellow-50 dark:bg-yellow-950">
      <CardContent className="py-4 px-6">
        <div className="flex items-center gap-2 mb-4">
          <CalendarDays className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
          <span className="text-sm font-semibold text-yellow-800 dark:text-yellow-200">
            Upcoming Deadlines — Alerts
          </span>
        </div>

        {/* Filter Buttons */}
        <div className="flex flex-wrap gap-2 mb-4">
          <Button
            variant={filter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('all')}
            className="text-xs h-8"
          >
            All ({counts.all})
          </Button>
          <Button
            variant={filter === '7days' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('7days')}
            className="text-xs h-8"
          >
            7 Days ({counts['7days']})
          </Button>
          <Button
            variant={filter === '3days' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('3days')}
            className="text-xs h-8"
          >
            3 Days ({counts['3days']})
          </Button>
          <Button
            variant={filter === 'today' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('today')}
            className="text-xs h-8"
          >
            Due Today ({counts.today})
          </Button>
          <Button
            variant={filter === 'overdue' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('overdue')}
            className="text-xs h-8"
          >
            Overdue ({counts.overdue})
          </Button>
        </div>

        {/* Items List */}
        {filtered.length === 0 ? (
          <div className="text-xs text-muted-foreground text-center py-4">
            No items in this alert category
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {filtered.map((a) => {
              const days = daysUntil(a.due_date);
              return (
                <div key={a.id} className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-yellow-200 dark:border-yellow-800 rounded-lg px-3 py-2">
                  <div>
                    <div className="text-xs font-bold text-foreground dark:text-slate-100">{a.title}</div>
                    <div className="text-[11px] text-muted-foreground dark:text-slate-400">{a.tax_type}</div>
                  </div>
                  <Badge variant="outline" className={`text-[10px] font-semibold ml-2 ${
                    days < 0 ? 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 border-red-300 dark:border-red-700' :
                    days === 0 ? 'bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-300 border-orange-300 dark:border-orange-700' :
                    days <= 3 ? 'bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800' :
                    'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300 border-yellow-300 dark:border-yellow-700'
                  }`}>
                    {days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? 'Today' : `${days}d`}
                  </Badge>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}