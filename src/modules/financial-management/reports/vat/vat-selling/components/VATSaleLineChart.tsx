// components/VATSaleLineChart.tsx
// Horizontal bar chart — shows all 12 months by default, filtered range when active.

import { TrendingUp } from 'lucide-react';
import { Bar, BarChart, LabelList, XAxis, YAxis } from 'recharts';
import {
  Card, CardContent, CardFooter, CardHeader, CardTitle,
} from '@/components/ui/card';
import {
  ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig,
} from '@/components/ui/chart';
import { ChartEmptyState } from './ChartEmptyState';
import type { VATSaleChartPoint } from '../types';

const chartConfig = {
  amount: { label: 'VAT Amount', color: '#3b82f6' },
} satisfies ChartConfig;

const MONTH_KEYS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

interface VATSaleLineChartProps {
  data: VATSaleChartPoint[];
  isFiltered?: boolean;
}

export function VATSaleLineChart({ data, isFiltered = false }: VATSaleLineChartProps) {
  const years = new Set<number>();
  data.forEach((point) => {
    const d = new Date(point.date);
    if (!isNaN(d.getTime())) years.add(d.getFullYear());
  });
  const primaryYear = years.size > 0 ? Math.max(...years) : new Date().getFullYear();

  const monthMap: Record<string, number> = {};
  data.forEach((point) => {
    const d = new Date(point.date);
    if (isNaN(d.getTime())) return;
    const key = d.toLocaleDateString('en-PH', { month: 'short', year: 'numeric' });
    monthMap[key] = (monthMap[key] ?? 0) + point.amount;
  });

  let aggregated: { month: string; amount: number }[];
  if (!isFiltered) {
    aggregated = MONTH_KEYS.map((m) => ({
      month: `${m} ${primaryYear}`,
      amount: monthMap[`${m} ${primaryYear}`] ?? 0,
    }));
  } else {
    aggregated = Object.entries(monthMap)
      .map(([month, amount]) => ({ month, amount }))
      .sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime());
  }

  const nonZero  = aggregated.filter((d) => d.amount > 0);
  const isEmpty  = isFiltered && nonZero.length === 0;
  const trend    = nonZero.length >= 2
    ? ((nonZero[nonZero.length - 1].amount - nonZero[0].amount) / (nonZero[0].amount || 1)) * 100
    : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>VAT Sales Over Time</CardTitle>
      </CardHeader>
      <CardContent>
        {isEmpty ? (
          <div className="h-[280px]">
            <ChartEmptyState message="Try adjusting your date, customer, or supplier filters." />
          </div>
        ) : (
          <ChartContainer config={chartConfig}>
            <BarChart
              accessibilityLayer
              data={aggregated}
              layout="vertical"
              barSize={28}
              margin={{ right: 64, left: 0, top: 4, bottom: 4 }}
            >
              <YAxis
                dataKey="month"
                type="category"
                tickLine={false}
                axisLine={false}
                width={80}
                tick={{ fontSize: 12, fill: 'hsl(var(--foreground))' }}
              />
              <XAxis type="number" hide />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    hideLabel
                    formatter={(value) =>
                      `₱${(value as number).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`
                    }
                  />
                }
              />
              <Bar dataKey="amount" layout="vertical" fill="#3b82f6" radius={4} minPointSize={2}>
                <LabelList
                  dataKey="amount"
                  position="right"
                  offset={8}
                  className="fill-foreground"
                  fontSize={12}
                  formatter={(v: number) =>
                    v === 0 ? '' :
                      v >= 1_000_000 ? `₱${(v / 1_000_000).toFixed(1)}M` :
                      v >= 1000     ? `₱${(v / 1000).toFixed(0)}k` :
                                      `₱${v.toFixed(0)}`
                  }
                />
              </Bar>
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
      {!isEmpty && (
        <CardFooter className="flex-col items-start gap-2 text-sm">
          <div className="flex gap-2 leading-none font-medium">
            {trend >= 0
              ? `Trending up ${trend.toFixed(1)}% over period`
              : `Trending down ${Math.abs(trend).toFixed(1)}% over period`}
            <TrendingUp className={`h-4 w-4 ${trend < 0 ? 'rotate-180 text-red-500' : ''}`} />
          </div>
          <div className="leading-none text-muted-foreground">Showing monthly VAT sales totals</div>
        </CardFooter>
      )}
    </Card>
  );
}