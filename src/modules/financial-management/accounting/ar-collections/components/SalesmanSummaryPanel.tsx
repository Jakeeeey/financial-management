// SalesmanSummaryPanel.tsx
import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CollectionsMergedRow, SalesmanPerformance } from '../types';
import { formatPeso } from '../../accounts-receivable/utils';
import { Trophy } from 'lucide-react';

interface SalesmanSummaryPanelProps {
  rows: CollectionsMergedRow[];
  loading: boolean;
}

export function SalesmanSummaryPanel({ rows, loading }: SalesmanSummaryPanelProps) {
  const performanceList = useMemo<SalesmanPerformance[]>(() => {
    if (loading || rows.length === 0) return [];

    const map: Record<string, {
      name: string;
      code: string;
      totalOutstanding: number;
      ptpCount: number;
      ptpKeptCount: number;
      ptpBrokenCount: number;
    }> = {};

    rows.forEach((row) => {
      const { invoice, commitment } = row;
      const key = invoice.salesman && invoice.salesman.trim() ? invoice.salesman.trim() : 'Unknown';
      if (!map[key]) {
        map[key] = {
          name: key,
          code: invoice.salesmanCode || '—',
          totalOutstanding: 0,
          ptpCount: 0,
          ptpKeptCount: 0,
          ptpBrokenCount: 0,
        };
      }

      const sales = map[key];
      sales.totalOutstanding += invoice.outstanding;
      if (commitment) {
        sales.ptpCount += 1;
        if (commitment.status === 'kept') {
          sales.ptpKeptCount += 1;
        } else if (commitment.status === 'broken') {
          sales.ptpBrokenCount += 1;
        }
      }
    });

    return Object.values(map).map((sales) => {
      const rate = sales.ptpCount > 0 ? (sales.ptpKeptCount / sales.ptpCount) * 100 : 100;
      
      let rating: SalesmanPerformance['performanceRating'] = 'medium';
      if (rate >= 80) rating = 'high';
      else if (rate < 50) rating = 'low';

      return {
        ...sales,
        fulfillmentRate: rate,
        performanceRating: rating,
      };
    }).sort((a, b) => b.totalOutstanding - a.totalOutstanding);
  }, [rows, loading]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-2">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <span className="text-xs text-muted-foreground font-medium">Aggregating performance metrics...</span>
      </div>
    );
  }

  if (performanceList.length === 0) {
    return (
      <div className="text-center py-12 text-xs text-muted-foreground border border-dashed rounded-xl">
        No salesman data available.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="border border-border/50 bg-card/40 shadow-sm">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Trophy className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            Salesman Collection Performance
          </CardTitle>
          <CardDescription className="text-[10px]">
            Tracks check-in efficiency and invoice promise fulfillment rates by salesperson.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {performanceList.map((sales) => {
              const ratingConfig = {
                high: { label: 'High Performer', className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
                medium: { label: 'Average', className: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
                low: { label: 'At Risk', className: 'bg-rose-500/10 text-rose-600 border-rose-500/20 animate-pulse' },
              }[sales.performanceRating];

              return (
                <div
                  key={sales.name}
                  className="p-4 rounded-xl border border-border/50 bg-card/60 flex flex-col justify-between space-y-3 hover:shadow-md transition-all duration-300"
                >
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-foreground truncate">{sales.name}</h4>
                      <p className="text-[9px] text-muted-foreground">Code: {sales.code}</p>
                    </div>
                    <Badge className={`text-[8px] font-black px-1.5 py-0.5 border rounded-md ${ratingConfig.className}`}>
                      {ratingConfig.label}
                    </Badge>
                  </div>

                  <div className="space-y-1.5 text-[10px]">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Outstanding:</span>
                      <span className="font-bold text-foreground">{formatPeso(sales.totalOutstanding)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Promises Tracked:</span>
                      <span className="font-bold text-foreground">{sales.ptpCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Kept / Broken:</span>
                      <span className="font-semibold text-foreground">
                        <span className="text-emerald-500">{sales.ptpKeptCount}</span> / <span className="text-rose-500">{sales.ptpBrokenCount}</span>
                      </span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-dashed border-border/40">
                      <span className="text-muted-foreground font-semibold">Fulfillment Rate:</span>
                      <span className="font-black text-purple-600 dark:text-purple-400">
                        {sales.fulfillmentRate.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
