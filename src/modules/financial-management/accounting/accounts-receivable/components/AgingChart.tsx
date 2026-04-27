// components/AgingChart.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ChartEmptyState } from './ChartEmptyState';
import { formatPeso } from '../utils';
import type { AgingBucket } from '../types';

interface AgingChartProps {
  data: AgingBucket[];
  isFiltered?: boolean;
}

export function AgingChart({ data, isFiltered = false }: AgingChartProps) {
  const hasData = data.some((d) => d.amount > 0);
  const isEmpty = isFiltered && !hasData;

  return (
    <Card className="min-w-0 overflow-hidden w-full">
      <CardHeader>
        <CardTitle className="text-sm font-medium">Aging Analysis</CardTitle>
      </CardHeader>
      <CardContent className="h-[200px] min-w-0 w-full">
        {isEmpty ? (
          <ChartEmptyState message="No aging data for the selected filters." />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ left: 16 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(128,128,128,0.1)" />
              <XAxis dataKey="range" fontSize={12} />
              <YAxis
                fontSize={11}
                width={110}
                tickFormatter={(val) =>
                  `₱${val.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                }
              />
              <Tooltip
                formatter={(val: number) => [formatPeso(val), 'Amount']}
                contentStyle={{
                  backgroundColor: 'hsl(var(--popover))',
                  borderColor: 'hsl(var(--border))',
                  color: 'hsl(var(--popover-foreground))',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
                labelStyle={{ color: 'hsl(var(--muted-foreground))' }}
              />
              <Bar dataKey="amount" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={40} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}