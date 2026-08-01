// calendarHelpers.ts
import { startOfMonth, endOfMonth, eachDayOfInterval, format } from 'date-fns';
import { ARCollectionCommitment, CalendarDayData } from '../types';

/**
 * Builds an array of CalendarDayData objects representing all days in the month of the target date.
 */
export function buildMonthlyCalendarData(
  targetDate: Date,
  commitments: ARCollectionCommitment[]
): CalendarDayData[] {
  const start = startOfMonth(targetDate);
  const end = endOfMonth(targetDate);
  const days = eachDayOfInterval({ start, end });

  // Find max collection expected on any day to calibrate heat scale
  const dailyTotals = new Map<string, number>();
  commitments.forEach((ptp) => {
    const key = ptp.commitmentDate; // YYYY-MM-DD
    dailyTotals.set(key, (dailyTotals.get(key) || 0) + ptp.committedAmount);
  });
  
  const maxDailyTotal = Math.max(...Array.from(dailyTotals.values()), 1);

  return days.map((day) => {
    const formattedDate = format(day, 'yyyy-MM-dd');
    const dayCommitments = commitments.filter((ptp) => ptp.commitmentDate === formattedDate);
    const totalExpected = dayCommitments.reduce((sum, ptp) => sum + ptp.committedAmount, 0);
    
    // Status dot aggregation
    const statusMap = new Map<ARCollectionCommitment['status'], number>();
    dayCommitments.forEach((ptp) => {
      statusMap.set(ptp.status, (statusMap.get(ptp.status) || 0) + 1);
    });

    const statusDots = Array.from(statusMap.entries()).map(([status, count]) => ({
      status,
      count,
    }));

    // Heat intensity scale: 0 if no commitments, up to 1 based on amount relative to max day
    const intensity = totalExpected > 0 ? Math.min(0.1 + (totalExpected / maxDailyTotal) * 0.9, 1) : 0;

    return {
      date: day,
      formattedDate,
      totalExpected,
      commitments: dayCommitments,
      statusDots,
      intensity,
    };
  });
}
