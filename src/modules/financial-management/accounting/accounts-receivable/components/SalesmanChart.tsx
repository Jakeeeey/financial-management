// components/SalesmanChart.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { ChartEmptyState } from './ChartEmptyState';
import { formatPeso } from '../utils';
import type { NamedValue } from '../types';

interface SalesmanChartProps {
  data: NamedValue[];
  isFiltered?: boolean;
}

export function SalesmanChart({ data, isFiltered = false }: SalesmanChartProps) {
  const isEmpty = isFiltered && data.length === 0;

  return (
    <Card className="min-w-0 overflow-hidden w-full">
      <CardHeader>
        <CardTitle className="text-sm font-medium">Outstanding by Salesman</CardTitle>
      </CardHeader>
      <CardContent className="min-w-0 w-full">
        {isEmpty ? (
          <div className="h-[180px]">
            <ChartEmptyState message="No salesman data for the selected filters." />
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={data} margin={{ top: 0, right: 8, left: 16, bottom: 50 }} barCategoryGap="25%">
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(128,128,128,0.1)" />
                <XAxis
                  dataKey="name"
                  fontSize={10}
                  angle={-30}
                  textAnchor="end"
                  interval={0}
                  tickFormatter={(v) => v.length > 14 ? v.slice(0, 14) + '…' : v}
                />
                <YAxis
                  fontSize={10}
                  width={120}
                  tickFormatter={(v) =>
                    `₱${v.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  }
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <div className="bg-popover border border-border rounded-lg shadow-lg px-3 py-2 text-xs">
                        <p className="font-bold text-foreground mb-1">{label}</p>
                        <p className="text-violet-500 font-semibold">{formatPeso(payload[0].value as number)}</p>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={40}>
                  {data.map((_, i) => (
                    <Cell key={i} fill={`hsl(${258 - i * 15}, 65%, ${58 + i * 3}%)`} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 pl-1">
              {data.map((s, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <span
                    className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                    style={{ backgroundColor: `hsl(${258 - i * 15}, 65%, ${58 + i * 3}%)` }}
                  />
                  <span className="text-[10px] text-muted-foreground truncate max-w-[100px]" title={s.name}>
                    {s.name.length > 12 ? s.name.slice(0, 12) + '…' : s.name}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}