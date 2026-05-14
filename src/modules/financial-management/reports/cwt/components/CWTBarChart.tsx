// components/CWTBarChart.tsx
// Bar chart showing CWT amounts per customer (top 8).

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import type { AggregatedEntry } from '../types';

interface CWTBarChartProps {
  data: AggregatedEntry[];
}

export function CWTBarChart({ data }: CWTBarChartProps) {
  return (
    <Card className="shadow-none">
      <CardHeader className="border-b border-border/50 pb-3">
        <CardTitle className="text-sm font-semibold">CWT by Customer</CardTitle>
      </CardHeader>
      <CardContent className="pt-4 h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data.slice(0, 8)} margin={{ bottom: 40 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(128,128,128,0.1)" />
            <XAxis
              dataKey="name"
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'currentColor', fontSize: 10, opacity: 0.5 }}
              angle={-30}
              textAnchor="end"
              interval={0}
              tickFormatter={(v) => v.length > 12 ? v.slice(0, 12) + '…' : v}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'currentColor', fontSize: 11, opacity: 0.5 }}
              tickFormatter={(v) => `₱${(v / 1000).toFixed(0)}k`}
              width={55}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                return (
                  <div className="bg-popover border border-border rounded-lg shadow-lg px-3 py-2 text-xs">
                    <p className="font-bold text-foreground mb-1">{label}</p>
                    <p className="text-blue-500 font-semibold">
                      ₱{(payload[0].value as number).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                );
              }}
            />
            <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={36} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}