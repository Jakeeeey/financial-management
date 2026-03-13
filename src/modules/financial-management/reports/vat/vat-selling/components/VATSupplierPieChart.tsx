// components/VATSupplierPieChart.tsx
// Donut pie chart showing VAT distribution by supplier — top 10 + "Others" bucket.

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { ChartEmptyState } from './ChartEmptyState';
import { COLORS } from '../utils';
import type { VATCustomerEntry } from '../types';

const TOP_N = 10;

interface VATSupplierPieChartProps {
  data: VATCustomerEntry[];
  isFiltered?: boolean;
}

export function VATSupplierPieChart({ data, isFiltered = false }: VATSupplierPieChartProps) {
  const isEmpty = isFiltered && data.length === 0;
  const total   = data.reduce((s, d) => s + d.value, 0);

  const top          = data.slice(0, TOP_N);
  const rest         = data.slice(TOP_N);
  const othersTotal  = rest.reduce((s, d) => s + d.value, 0);
  const chartData: VATCustomerEntry[] = [
    ...top,
    ...(othersTotal > 0 ? [{ name: `Others (${rest.length})`, value: othersTotal, color: '#94a3b8' }] : []),
  ];

  return (
    <Card className="shadow-none">
      <CardHeader className="border-b border-border/50 pb-3">
        <CardTitle className="text-sm font-semibold">VAT by Supplier</CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        {isEmpty ? (
          <div className="h-[220px]">
            <ChartEmptyState message="No suppliers match the current filter combination." />
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={chartData}
                  innerRadius={65}
                  outerRadius={95}
                  paddingAngle={3}
                  dataKey="value"
                  stroke="none"
                >
                  {chartData.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={entry.name.startsWith('Others') ? '#94a3b8' : COLORS[i % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const e = payload[0].payload;
                    return (
                      <div className="bg-popover border border-border rounded-lg shadow-lg px-3 py-2 text-xs space-y-0.5">
                        <p className="font-bold text-foreground">{e.name}</p>
                        <p className="text-muted-foreground">
                          ₱{e.value.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </p>
                        <p className="text-muted-foreground">
                          {((e.value / total) * 100).toFixed(1)}% of total
                        </p>
                      </div>
                    );
                  }}
                />
              </PieChart>
            </ResponsiveContainer>

            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-3 mb-3 px-1">
              {chartData.map((entry, i) => (
                <div key={i} className="flex items-center gap-1.5 min-w-0">
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: entry.name.startsWith('Others') ? '#94a3b8' : COLORS[i % COLORS.length] }}
                  />
                  <span className="text-[11px] text-muted-foreground truncate" title={entry.name}>
                    {entry.name}
                  </span>
                </div>
              ))}
            </div>

            <div className="border border-border rounded-lg overflow-hidden">
              <details className="group">
                <summary className="flex items-center justify-between px-4 py-2.5 cursor-pointer bg-muted/30 hover:bg-muted/50 transition-colors text-xs font-semibold select-none">
                  <span>View All Suppliers ({data.length})</span>
                  <span className="group-open:rotate-180 transition-transform duration-200">▾</span>
                </summary>
                <div className="max-h-52 overflow-y-auto divide-y divide-border/40">
                  {data.map((entry, i) => (
                    <div key={i} className="flex items-center justify-between px-4 py-2 text-xs hover:bg-muted/20 transition-colors">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: i < TOP_N ? COLORS[i % COLORS.length] : '#94a3b8' }}
                        />
                        <span className="truncate font-medium text-foreground" title={entry.name}>
                          {entry.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                        <span className="text-muted-foreground tabular-nums">
                          {((entry.value / total) * 100).toFixed(1)}%
                        </span>
                        <span className="font-bold text-primary tabular-nums">
                          ₱{entry.value.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}