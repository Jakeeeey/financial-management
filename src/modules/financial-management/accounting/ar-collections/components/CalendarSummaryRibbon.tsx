// CalendarSummaryRibbon.tsx
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { formatPeso } from '../../accounts-receivable/utils';
import { Calendar, DollarSign, AlertCircle, XCircle } from 'lucide-react';

interface CalendarSummaryRibbonProps {
  summary: {
    ptpsThisMonthCount: number;
    expectedCollections: number;
    atRiskToday: number;
    brokenThisMonthCount: number;
    brokenRate: number;
  };
}

export function CalendarSummaryRibbon({ summary }: CalendarSummaryRibbonProps) {
  const stats = [
    {
      label: 'PTPs This Month',
      value: summary.ptpsThisMonthCount,
      desc: 'Active commitments',
      icon: <Calendar className="h-4 w-4 text-purple-600 dark:text-purple-400" />,
    },
    {
      label: 'Expected Collections',
      value: formatPeso(summary.expectedCollections),
      desc: 'Total committed sum',
      icon: <DollarSign className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />,
    },
    {
      label: 'At Risk Today',
      value: formatPeso(summary.atRiskToday),
      desc: 'Pending PTPs due today',
      icon: <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />,
    },
    {
      label: 'Broken Promises',
      value: `${summary.brokenThisMonthCount} (${summary.brokenRate.toFixed(1)}%)`,
      desc: 'Unfulfilled commitments',
      icon: <XCircle className="h-4 w-4 text-rose-600 dark:text-rose-400" />,
    },
  ];

  return (
    <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
      {stats.map((stat, idx) => (
        <Card key={idx} className="border border-border/50 bg-card/40 shadow-sm backdrop-blur-md">
          <CardContent className="p-3 flex items-center justify-between gap-3">
            <div className="min-w-0 space-y-0.5">
              <span className="text-[9px] font-bold text-muted-foreground uppercase block truncate tracking-wide">
                {stat.label}
              </span>
              <span className="text-sm font-black text-foreground block tabular-nums">
                {stat.value}
              </span>
              <span className="text-[8px] text-muted-foreground/75 block truncate">
                {stat.desc}
              </span>
            </div>
            <div className="p-2 rounded-lg bg-muted/40 shrink-0">{stat.icon}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
