// tax-calendar/components/UpcomingBanner.tsx
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CalendarDays } from 'lucide-react';
import { daysUntil } from '../utils';
import type { TaxActivity } from '../types';

interface Props { upcoming: TaxActivity[] }

export function UpcomingBanner({ upcoming }: Props) {
  if (upcoming.length === 0) return null;
  return (
    <Card className="shadow-none border-yellow-200 dark:border-yellow-900 bg-yellow-50 dark:bg-yellow-950">
      <CardContent className="py-4 px-6">
        <div className="flex items-center gap-2 mb-3">
          <CalendarDays className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
          <span className="text-sm font-semibold text-yellow-800 dark:text-yellow-200">
            Upcoming Deadlines — Next 7 Days
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {upcoming.map((a) => {
            const days = daysUntil(a.due_date);
            return (
              <div key={a.id} className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-yellow-200 dark:border-yellow-800 rounded-lg px-3 py-2">
                <div>
                  <div className="text-xs font-bold text-foreground dark:text-slate-100">{a.title}</div>
                  <div className="text-[11px] text-muted-foreground dark:text-slate-400">{a.tax_type}</div>
                </div>
                <Badge variant="outline" className={`text-[10px] font-semibold ml-2 ${
                  days <= 7 ? 'bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800' : 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300 border-yellow-300 dark:border-yellow-700'
                }`}>
                  {days === 0 ? 'Today' : `${days}d`}
                </Badge>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}