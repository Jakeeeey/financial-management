// components/EWTPieChart.tsx
// Pie chart showing EWT distribution by customer, with a scrollable dropdown legend.

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { formatPeso } from '../utils';
import type { PieEntry } from '../types';

const COLORS = ['#6366f1', '#a855f7', '#ec4899', '#f97316', '#22c55e', '#06b6d4'];

interface EWTPieChartProps {
  data: PieEntry[];
  totalAmount: number;
}

export function EWTPieChart({ data, totalAmount }: EWTPieChartProps) {
  return (
    <Card className="shadow-none border-border">
      <CardHeader className="border-b border-border/50 pb-3">
        <CardTitle className="text-sm font-bold">EWT Distribution by Customer</CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              outerRadius={120}
              dataKey="value"
              label={({ percent }) => `${(percent * 100).toFixed(1)}%`}
              labelLine={false}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const entry = payload[0].payload;
                return (
                  <div className="bg-popover border border-border rounded-lg shadow-lg px-3 py-2 text-xs">
                    <p className="font-bold text-foreground">{entry.name}</p>
                    <p className="text-muted-foreground mt-0.5">{formatPeso(entry.value)}</p>
                    <p className="text-muted-foreground">
                      {((entry.value / totalAmount) * 100).toFixed(1)}% of total
                    </p>
                  </div>
                );
              }}
            />
          </PieChart>
        </ResponsiveContainer>

        {/* Scrollable dropdown legend */}
        <div className="mt-3 border border-border rounded-lg overflow-hidden">
          <details className="group">
            <summary className="flex items-center justify-between px-4 py-2.5 cursor-pointer bg-muted/30 hover:bg-muted/50 transition-colors text-xs font-semibold select-none">
              <span>View All Customers ({data.length})</span>
              <span className="group-open:rotate-180 transition-transform">▾</span>
            </summary>
            <div className="max-h-48 overflow-y-auto divide-y divide-border/40">
              {data
                .slice()
                .sort((a, b) => b.value - a.value)
                .map((entry, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-2 text-xs hover:bg-muted/20 transition-colors">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: COLORS[data.indexOf(entry) % COLORS.length] }}
                      />
                      <span className="truncate text-foreground font-medium">{entry.name}</span>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0 ml-2">
                      <span className="text-muted-foreground">
                        {((entry.value / totalAmount) * 100).toFixed(1)}%
                      </span>
                      <span className="font-bold text-primary">{formatPeso(entry.value)}</span>
                    </div>
                  </div>
                ))}
            </div>
          </details>
        </div>
      </CardContent>
    </Card>
  );
}