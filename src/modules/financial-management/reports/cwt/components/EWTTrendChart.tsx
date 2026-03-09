// components/EWTTrendChart.tsx
// Area chart showing monthly EWT trend over time.

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import { TrendingUp } from 'lucide-react';
import { formatPeso } from '../utils';
import type { TrendEntry } from '../types';

interface EWTTrendChartProps {
  data: TrendEntry[];
}

export function EWTTrendChart({ data }: EWTTrendChartProps) {
  return (
    <Card className="shadow-none border-border">
      <CardHeader className="border-b border-border/50 pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-bold">EWT Trend Analysis</CardTitle>
        <span className="text-xs text-emerald-500 flex items-center gap-1 font-semibold">
          <TrendingUp className="w-3 h-3" /> Monthly Overview
        </span>
      </CardHeader>
      <CardContent className="pt-4">
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="ewtGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={formatPeso} tick={{ fontSize: 11 }} width={80} />
            <Tooltip formatter={(v: number) => formatPeso(v)} />
            <Area
              type="monotone"
              dataKey="amount"
              name="EWT Amount"
              stroke="#6366f1"
              strokeWidth={2}
              fill="url(#ewtGradient)"
              dot={{ r: 4, fill: '#6366f1' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}