// useCommitmentCalendar.ts
import { useMemo } from 'react';
import { ARCollectionCommitment } from '../types';
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isAfter, format } from 'date-fns';

export interface CalendarWeekData {
  weekIndex: number;
  weekStart: Date;
  weekEnd: Date;
  formattedRange: string;
  totalExpected: number;
  commitments: ARCollectionCommitment[];
  salesmanBreakdown: {
    salesmanId: number;
    salesmanName: string;
    salesmanCode: string;
    totalExpected: number;
    count: number;
  }[];
}

export function buildWeeklyCalendarData(
  targetDate: Date,
  commitments: ARCollectionCommitment[]
): CalendarWeekData[] {
  const startMonth = startOfMonth(targetDate);
  const endMonth = endOfMonth(targetDate);
  
  const startOfFirstWeek = startOfWeek(startMonth, { weekStartsOn: 0 }); // Sunday
  const endOfLastWeek = endOfWeek(endMonth, { weekStartsOn: 0 }); // Saturday
  
  const weeks: CalendarWeekData[] = [];
  let currentStart = startOfFirstWeek;
  let index = 1;
  
  while (!isAfter(currentStart, endOfLastWeek)) {
    const currentEnd = endOfWeek(currentStart, { weekStartsOn: 0 });
    
    // Filter commitments falling in this week
    const weekCommitments = commitments.filter((c) => {
      if (!c.commitmentDate) return false;
      const cDate = new Date(c.commitmentDate);
      cDate.setHours(0, 0, 0, 0);
      const s = new Date(currentStart);
      s.setHours(0, 0, 0, 0);
      const e = new Date(currentEnd);
      e.setHours(23, 59, 59, 999);
      return cDate >= s && cDate <= e;
    });
    
    const totalExpected = weekCommitments.reduce((sum, c) => sum + c.committedAmount, 0);
    
    // Group by salesman
    const salesmanMap = new Map<number, {
      salesmanId: number;
      salesmanName: string;
      salesmanCode: string;
      totalExpected: number;
      count: number;
    }>();
    
    weekCommitments.forEach((c) => {
      const smId = c.salesmanId || 0;
      if (!salesmanMap.has(smId)) {
        salesmanMap.set(smId, {
          salesmanId: smId,
          salesmanName: c.salesmanName || 'Unknown',
          salesmanCode: c.salesmanCode || '—',
          totalExpected: 0,
          count: 0,
        });
      }
      const data = salesmanMap.get(smId)!;
      data.totalExpected += c.committedAmount;
      data.count += 1;
    });
    
    weeks.push({
      weekIndex: index++,
      weekStart: currentStart,
      weekEnd: currentEnd,
      formattedRange: `${format(currentStart, 'MMM d')} - ${format(currentEnd, 'MMM d, yyyy')}`,
      totalExpected,
      commitments: weekCommitments,
      salesmanBreakdown: Array.from(salesmanMap.values()).sort((a, b) => b.totalExpected - a.totalExpected),
    });
    
    currentStart = addDays(currentEnd, 1);
  }
  
  return weeks;
}

export function useCommitmentCalendar(
  currentMonth: Date,
  commitments: ARCollectionCommitment[]
) {
  const weeklyCalendarData = useMemo(() => {
    return buildWeeklyCalendarData(currentMonth, commitments);
  }, [currentMonth, commitments]);

  const summary = useMemo(() => {
    const ptpsThisMonth = commitments.filter((c) => {
      if (!c.commitmentDate) return false;
      const cDate = new Date(c.commitmentDate);
      return (
        cDate.getMonth() === currentMonth.getMonth() &&
        cDate.getFullYear() === currentMonth.getFullYear()
      );
    });

    const expectedCollections = ptpsThisMonth.reduce(
      (sum, c) => sum + c.committedAmount,
      0
    );

    const todayStr = new Date().toISOString().split('T')[0];
    const atRiskToday = commitments
      .filter((c) => c.commitmentDate === todayStr && c.status === 'pending')
      .reduce((sum, c) => sum + c.committedAmount, 0);

    const brokenThisMonth = ptpsThisMonth.filter((c) => c.status === 'broken').length;
    const brokenRate = ptpsThisMonth.length > 0 ? (brokenThisMonth / ptpsThisMonth.length) * 100 : 0;

    return {
      ptpsThisMonthCount: ptpsThisMonth.length,
      expectedCollections,
      atRiskToday,
      brokenThisMonthCount: brokenThisMonth,
      brokenRate,
    };
  }, [currentMonth, commitments]);

  return {
    weeklyCalendarData,
    summary,
  };
}
