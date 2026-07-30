// CommitmentCalendar.tsx
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CalendarSummaryRibbon } from './CalendarSummaryRibbon';
import { useCommitmentCalendar } from '../hooks/useCommitmentCalendar';
import { ARCollectionCommitment } from '../types';
import { ChevronLeft, ChevronRight, CalendarDays, ChevronDown, ChevronUp, User, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { format, addMonths, subMonths } from 'date-fns';
import { formatPeso, formatDate } from '../../accounts-receivable/utils';
import { useCommitmentActions } from '../hooks/useCommitmentActions';

interface CommitmentCalendarProps {
  commitments: ARCollectionCommitment[];
  onRefresh?: () => void;
}

export function CommitmentCalendar({ commitments, onRefresh }: CommitmentCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [expandedWeeks, setExpandedWeeks] = useState<Record<number, boolean>>({ 1: true });

  const { weeklyCalendarData, summary } = useCommitmentCalendar(currentMonth, commitments);
  const { updateStatus, submitting } = useCommitmentActions(onRefresh);

  const handlePrevMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
    setExpandedWeeks({ 1: true });
  };

  const handleNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
    setExpandedWeeks({ 1: true });
  };

  const handleToday = () => {
    setCurrentMonth(new Date());
    setExpandedWeeks({ 1: true });
  };

  const toggleWeek = (index: number) => {
    setExpandedWeeks(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  const monthLabel = format(currentMonth, 'MMMM yyyy');

  const handleStatusUpdate = async (id: string, status: 'kept' | 'broken') => {
    await updateStatus(id, status, `Marked as ${status} from weekly calendar.`);
  };

  return (
    <div className="space-y-4">
      {/* Summary Stats above the Calendar */}
      <CalendarSummaryRibbon summary={summary} />

      <Card className="border border-border/60 bg-card/30 backdrop-blur-md shadow-sm">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 pb-2 gap-4">
          <div>
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              Weekly Commitments Board ({monthLabel})
            </CardTitle>
            <CardDescription className="text-[10px]">
              Visualize expected payment timelines and customer promises grouped on a weekly basis.
            </CardDescription>
          </div>

          {/* Navigation Controls */}
          <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
            <Button variant="outline" size="icon" className="h-7 w-7" onClick={handlePrevMonth}>
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="text-xs font-black min-w-[90px] text-center">{monthLabel}</span>
            <Button variant="outline" size="icon" className="h-7 w-7" onClick={handleNextMonth}>
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
            <Button variant="outline" size="sm" className="h-7 text-[10px] px-2" onClick={handleToday}>
              Today
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-4 space-y-3">
          {weeklyCalendarData.map((week) => {
            const isExpanded = !!expandedWeeks[week.weekIndex];
            const hasCommitments = week.commitments.length > 0;

            return (
              <div 
                key={week.weekIndex}
                className="border border-border/40 rounded-xl overflow-hidden bg-background/50 backdrop-blur-xs shadow-xs"
              >
                {/* Week Header Row */}
                <div 
                  onClick={() => toggleWeek(week.weekIndex)}
                  className="flex items-center justify-between p-3.5 bg-muted/20 hover:bg-muted/30 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-xs font-bold text-foreground">Week {week.weekIndex}</span>
                    <Badge variant="outline" className="text-[9px] font-semibold border-border/80 text-muted-foreground bg-background py-0 h-4">
                      {week.formattedRange}
                    </Badge>
                    {hasCommitments && (
                      <span className="text-[10px] text-muted-foreground hidden sm:inline">
                        ({week.commitments.length} PTPs scheduled)
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right">
                      <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-bold">Total Expected</div>
                      <div className="text-xs font-bold text-purple-600 dark:text-purple-400 tabular-nums">
                        {formatPeso(week.totalExpected)}
                      </div>
                    </div>
                    {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </div>

                {/* Week Details Content */}
                {isExpanded && (
                  <div className="p-4 border-t border-border/30 bg-card/10 space-y-4">
                    {/* Salesman breakdown list */}
                    {hasCommitments && (
                      <div className="flex flex-wrap gap-2 pb-1 border-b border-border/20 shrink-0">
                        {week.salesmanBreakdown.map((sm) => (
                          <div 
                            key={sm.salesmanId}
                            className="flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-purple-500/20 bg-purple-500/5 text-[9px] font-semibold text-purple-600 dark:text-purple-400"
                          >
                            <User className="h-2.5 w-2.5" />
                            <span>{sm.salesmanName}: {formatPeso(sm.totalExpected)}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Commitments list */}
                    {!hasCommitments ? (
                      <div className="text-center py-6 text-xs text-muted-foreground flex flex-col items-center justify-center gap-1.5">
                        <AlertCircle className="h-5 w-5 text-muted-foreground/45" />
                        No payment commitments scheduled for this week.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {week.commitments.map((ptp) => {
                          const todayStr = new Date().toISOString().split('T')[0];
                          const isMissed = ptp.status === 'pending' && ptp.commitmentDate < todayStr;
                          
                          return (
                            <div 
                              key={ptp.id}
                              className={`flex flex-col md:flex-row md:items-center justify-between p-3 rounded-lg border border-border/40 hover:bg-muted/15 transition-all gap-3 ${
                                isMissed ? 'border-rose-500/30 bg-rose-500/2' : 'bg-background/40'
                              }`}
                            >
                              {/* Left details */}
                              <div className="min-w-0 space-y-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-bold text-xs text-foreground truncate max-w-[180px]">
                                    {ptp.customerName || 'Customer Details Missing'}
                                  </span>
                                  <span className="text-[9px] text-muted-foreground uppercase tracking-wider">
                                    {ptp.customerCode}
                                  </span>
                                </div>
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground font-medium">
                                  <span>Invoice: <strong className="text-foreground">{ptp.invoiceNo}</strong></span>
                                  <span>Salesman: <strong>{ptp.salesmanName}</strong></span>
                                  <span className={`flex items-center gap-0.5 ${isMissed ? 'text-rose-500 font-bold' : ''}`}>
                                    PTP: <strong>{formatDate(ptp.commitmentDate)}</strong>
                                    {isMissed && ' (Missed)'}
                                  </span>
                                </div>
                              </div>

                              {/* Right details & action */}
                              <div className="flex items-center justify-between md:justify-end gap-5 shrink-0 border-t md:border-t-0 pt-2.5 md:pt-0">
                                <div className="text-left md:text-right">
                                  <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Committed</div>
                                  <div className="text-xs font-bold text-foreground tabular-nums">
                                    {formatPeso(ptp.committedAmount)}
                                  </div>
                                </div>

                                <div className="flex items-center gap-1.5">
                                  {ptp.status === 'pending' ? (
                                    <>
                                      <Button 
                                        variant="outline"
                                        size="sm"
                                        disabled={submitting}
                                        onClick={() => handleStatusUpdate(ptp.id, 'kept')}
                                        className="h-7 text-[10px] gap-1 hover:bg-emerald-500/10 hover:text-emerald-600 dark:hover:text-emerald-400 font-bold text-muted-foreground"
                                      >
                                        <CheckCircle className="h-3 w-3 text-emerald-500" />
                                        Kept
                                      </Button>
                                      <Button 
                                        variant="outline"
                                        size="sm"
                                        disabled={submitting}
                                        onClick={() => handleStatusUpdate(ptp.id, 'broken')}
                                        className="h-7 text-[10px] gap-1 hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400 font-bold text-muted-foreground"
                                      >
                                        <XCircle className="h-3 w-3 text-rose-500" />
                                        Broken
                                      </Button>
                                    </>
                                  ) : (
                                    <Badge 
                                      variant="secondary"
                                      className={`text-[9px] font-extrabold uppercase py-0.5 px-2 tracking-wider ${
                                        ptp.status === 'kept' 
                                          ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' 
                                          : 'bg-rose-500/10 text-rose-600 border-rose-500/20'
                                      }`}
                                    >
                                      {ptp.status}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
