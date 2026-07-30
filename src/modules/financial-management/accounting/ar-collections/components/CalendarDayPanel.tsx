// CalendarDayPanel.tsx
import React from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { CalendarDayData } from '../types';
import { formatPeso } from '../../accounts-receivable/utils';
import { getStatusBadgeConfig } from '../utils/commitmentHelpers';
import { Check, X } from 'lucide-react';
import { useCommitmentActions } from '../hooks/useCommitmentActions';

interface CalendarDayPanelProps {
  dayData: CalendarDayData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function CalendarDayPanel({
  dayData,
  open,
  onOpenChange,
  onSuccess,
}: CalendarDayPanelProps) {
  const { updateStatus, submitting } = useCommitmentActions(() => {
    onSuccess?.();
    onOpenChange(false);
  });

  if (!dayData) return null;

  const dateLabel = dayData.date.toLocaleDateString('en-PH', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-[420px] flex flex-col h-full p-6">
        <SheetHeader className="border-b pb-4 shrink-0">
          <SheetTitle className="text-sm font-bold">Expectations for Day</SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground">
            {dateLabel}
          </SheetDescription>
          <div className="flex justify-between items-center pt-2">
            <span className="text-[10px] font-black tracking-wider text-muted-foreground uppercase">EXPECTED TOTAL</span>
            <span className="text-sm font-black text-purple-600 dark:text-purple-400">
              {formatPeso(dayData.totalExpected)}
            </span>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1 -mx-6 px-6 py-4">
          {dayData.commitments.length === 0 ? (
            <div className="text-center py-12 text-xs text-muted-foreground">
              No commitments logged for this day.
            </div>
          ) : (
            <div className="space-y-4">
              {dayData.commitments.map((ptp) => {
                const badge = getStatusBadgeConfig(ptp.status);
                return (
                  <div
                    key={ptp.id}
                    className="p-4 rounded-xl border border-border/50 bg-card/50 space-y-3 shadow-sm hover:shadow-md transition-all"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-foreground truncate">{ptp.customerName}</h4>
                        <p className="text-[9px] text-muted-foreground mt-0.5">Invoice #{ptp.invoiceNo}</p>
                      </div>
                      <Badge className={`text-[9px] shrink-0 font-bold px-2 py-0.5 rounded-full border ${badge.className}`}>
                        {badge.label}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[10px] py-1 border-t border-b border-dashed border-border/50">
                      <div>
                        <span className="text-muted-foreground block text-[9px]">Committed Amount</span>
                        <span className="font-bold text-foreground">{formatPeso(ptp.committedAmount)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[9px]">Salesman</span>
                        <span className="font-medium text-foreground truncate block">{ptp.salesmanName}</span>
                      </div>
                    </div>

                    {ptp.status === 'pending' && (
                      <div className="flex items-center gap-1.5 pt-1">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={submitting}
                          onClick={() => updateStatus(ptp.id, 'kept', 'Marked kept via calendar day panel.')}
                          className="h-7 px-2.5 text-[9px] gap-1 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/10 flex-1"
                        >
                          <Check className="h-3 w-3" />
                          Kept
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={submitting}
                          onClick={() => updateStatus(ptp.id, 'broken', 'Marked broken via calendar day panel.')}
                          className="h-7 px-2.5 text-[9px] gap-1 text-rose-600 dark:text-rose-400 border-rose-500/20 hover:bg-rose-500/10 flex-1"
                        >
                          <X className="h-3 w-3" />
                          Broken
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
