// components/EWTBarChart.tsx
// Dual-axis bar chart comparing EWT amount and transaction count per customer.

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import { BarChart2 } from 'lucide-react';
import { formatPeso } from '../utils';
import type { BarEntry } from '../types';

interface EWTBarChartProps {
  data: BarEntry[];
}

export function EWTBarChart({ data }: EWTBarChartProps) {
  return (
    <Card className="shadow-none border-border">
      <CardHeader className="border-b border-border/50 pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-bold">Customer-wise EWT Comparison</CardTitle>
        <span className="text-xs text-purple-500 flex items-center gap-1 font-semibold">
          <BarChart2 className="w-3 h-3" /> Top Customers
        </span>
      </CardHeader>
      <CardContent className="pt-4 pb-2">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart
            data={data}
            margin={{ top: 10, right: 16, left: 0, bottom: 100 }}
            barCategoryGap="30%"
            barGap={4}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.1)" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" interval={0} />
            <YAxis yAxisId="left" tickFormatter={formatPeso} tick={{ fontSize: 11 }} width={80} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} width={30} tickFormatter={(v) => `${v}x`} />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                return (
                  <div className="bg-popover border border-border rounded-lg shadow-lg px-3 py-2 text-xs space-y-1">
                    <p className="font-bold text-foreground mb-1">{label}</p>
                    {payload.map((p, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: p.fill }} />
                        <span className="text-muted-foreground">{p.name}:</span>
                        <span className="font-semibold text-foreground">
                          {p.name === 'EWT Amount'
                            ? formatPeso(p.value as number)
                            : `${p.value} transaction${(p.value as number) !== 1 ? 's' : ''}`}
                        </span>
                      </div>
                    ))}
                  </div>
                );
              }}
            />
            <Bar yAxisId="left" dataKey="amount" name="EWT Amount" fill="#a78bfa" radius={[4, 4, 0, 0]} maxBarSize={56} />
            <Bar yAxisId="right" dataKey="count" name="Transactions" fill="#f97316" radius={[4, 4, 0, 0]} maxBarSize={20} />
          </BarChart>
        </ResponsiveContainer>

        {/* Legend */}
        <div className="flex items-center gap-5 mt-2 pl-20">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: '#a78bfa' }} />
            <span className="text-xs font-medium text-muted-foreground">EWT Amount</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: '#f97316' }} />
            <span className="text-xs font-medium text-muted-foreground">Transactions</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}