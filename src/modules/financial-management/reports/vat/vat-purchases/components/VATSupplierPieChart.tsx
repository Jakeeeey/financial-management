// components/VATSupplierPieChart.tsx
// Donut pie chart showing VAT distribution by supplier with dropdown legend.

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { COLORS } from '../utils';
import type { VATSupplierEntry } from '../types';

interface VATSupplierPieChartProps {
  data: VATSupplierEntry[];
}

export function VATSupplierPieChart({ data }: VATSupplierPieChartProps) {
  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <Card className="shadow-none">
      <CardHeader className="border-b border-border/50 pb-3">
        <CardTitle className="text-sm font-semibold">VAT by Supplier</CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie data={data} innerRadius={60} outerRadius={90} paddingAngle={2} dataKey="value" stroke="none">
              {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const e = payload[0].payload;
                return (
                  <div className="bg-popover border border-border rounded-lg shadow-lg px-3 py-2 text-xs">
                    <p className="font-bold text-foreground">{e.name}</p>
                    <p className="text-muted-foreground">₱{e.value.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                    <p className="text-muted-foreground">{((e.value / total) * 100).toFixed(1)}% of total</p>
                  </div>
                );
              }}
            />
          </PieChart>
        </ResponsiveContainer>

        {/* Dropdown legend */}
        <div className="mt-2 border border-border rounded-lg overflow-hidden">
          <details className="group">
            <summary className="flex items-center justify-between px-4 py-2.5 cursor-pointer bg-muted/30 hover:bg-muted/50 transition-colors text-xs font-semibold select-none">
              <span>View All Suppliers ({data.length})</span>
              <span className="group-open:rotate-180 transition-transform duration-200">▾</span>
            </summary>
            <div className="max-h-44 overflow-y-auto divide-y divide-border/40">
              {data.map((entry, i) => (
                <div key={i} className="flex items-center justify-between px-4 py-2 text-xs hover:bg-muted/20 transition-colors">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color }} />
                    <span className="truncate font-medium text-foreground" title={entry.name}>{entry.name}</span>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                    <span className="text-muted-foreground tabular-nums">{((entry.value / total) * 100).toFixed(1)}%</span>
                    <span className="font-bold text-primary tabular-nums">₱{entry.value.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
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