// components/VATLineChart.tsx
// Horizontal bar chart — shows all 12 months by default, filtered range when active.

import { TrendingUp } from 'lucide-react';
import { Bar, BarChart, LabelList, XAxis, YAxis } from 'recharts';
import {
  Card, CardContent, CardFooter, CardHeader, CardTitle,
} from '@/components/ui/card';
import {
  ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig,
} from '@/components/ui/chart';
import type { VATChartPoint } from '../types';

const chartConfig = {
  amount: {
    label: 'VAT Amount',
    color: '#3b82f6',
  },
} satisfies ChartConfig;

// All 12 months in order, used to build the default scaffold
const MONTH_KEYS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

interface VATLineChartProps {
  data: VATChartPoint[];
  /** Pass true when a date/supplier filter is active so we show only months with data */
  isFiltered?: boolean;
}

export function VATLineChart({ data, isFiltered = false }: VATLineChartProps) {
  // Determine the year(s) present in data
  const years = new Set<number>();
  data.forEach((point) => {
    const d = new Date(point.date);
    if (!isNaN(d.getTime())) years.add(d.getFullYear());
  });
  const primaryYear = years.size > 0 ? Math.max(...years) : new Date().getFullYear();

  // Aggregate actual data by "Mon YYYY" key
  const monthMap: Record<string, number> = {};
  data.forEach((point) => {
    const d = new Date(point.date);
    if (isNaN(d.getTime())) return;
    const key = d.toLocaleDateString('en-PH', { month: 'short', year: 'numeric' });
    monthMap[key] = (monthMap[key] ?? 0) + point.amount;
  });

  let aggregated: { month: string; amount: number }[];

  if (!isFiltered) {
    // Default: scaffold all 12 months for the primary year, fill with actual data
    aggregated = MONTH_KEYS.map((m) => ({
      month: `${m} ${primaryYear}`,
      amount: monthMap[`${m} ${primaryYear}`] ?? 0,
    }));
  } else {
    // Filtered: show only months that have data, sorted chronologically
    aggregated = Object.entries(monthMap)
      .map(([month, amount]) => ({ month, amount }))
      .sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime());
  }

  const nonZero = aggregated.filter((d) => d.amount > 0);
  const trend = nonZero.length >= 2
    ? ((nonZero[nonZero.length - 1].amount - nonZero[0].amount) / (nonZero[0].amount || 1)) * 100
    : 0;

  // const dateRange = nonZero.length >= 2
  //   ? `${nonZero[0].month} – ${nonZero[nonZero.length - 1].month}`
  //   : nonZero[0]?.month ?? `Jan ${primaryYear} – Dec ${primaryYear}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle>VAT Over Time</CardTitle>
      </CardHeader>
      <CardContent>
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
                    v >= 1_000_000
                      ? `₱${(v / 1_000_000).toFixed(1)}M`
                      : v >= 1000
                        ? `₱${(v / 1000).toFixed(0)}k`
                        : `₱${v.toFixed(0)}`
                }
              />
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          {trend >= 0
            ? `Trending up ${trend.toFixed(1)}% over period`
            : `Trending down ${Math.abs(trend).toFixed(1)}% over period`}
          <TrendingUp className={`h-4 w-4 ${trend < 0 ? 'rotate-180 text-red-500' : ''}`} />
        </div>
        <div className="leading-none text-muted-foreground">
          Showing monthly VAT totals
        </div>
      </CardFooter>
    </Card>
  );
}