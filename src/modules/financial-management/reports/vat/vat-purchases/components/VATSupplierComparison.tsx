// components/VATSupplierComparison.tsx
// Progress bar list comparing VAT amounts across top suppliers.

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { COLORS } from '../utils';
import type { VATBarEntry } from '../types';

interface VATSupplierComparisonProps {
  data: VATBarEntry[];
}

export function VATSupplierComparison({ data }: VATSupplierComparisonProps) {
  return (
    <Card className="shadow-none">
      <CardHeader className="border-b border-border/50 pb-3">
        <CardTitle className="text-sm font-semibold">Supplier Comparison</CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="space-y-3">
          {data.slice(0, 8).map((item, i) => {
            const max = data[0]?.total || 1;
            const pct = Math.max((item.total / max) * 100, 2);
            const color = COLORS[i % COLORS.length];
            return (
              <div key={i}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-medium text-muted-foreground truncate max-w-[55%]" title={item.name}>
                    {item.name}
                  </span>
                  <span className="text-[11px] font-bold tabular-nums" style={{ color }}>
                    ₱{item.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${color}aa, ${color})` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}