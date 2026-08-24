// commitmentHelpers.ts
import { ARCollectionCommitment } from '../types';

/**
 * Derives the active status of a commitment based on its current status, PTP date, and payment status.
 */
export function getUpdatedCommitmentStatus(
  commitment: ARCollectionCommitment,
  invoicePaidStatus: string,
  invoiceOutstanding: number
): ARCollectionCommitment['status'] {
  // If explicitly resolved, keep that status
  if (commitment.status === 'kept' || commitment.status === 'waived') {
    return commitment.status;
  }

  // If the invoice is fully paid or outstanding is 0, then the promise is kept
  if (invoicePaidStatus === 'Paid' || invoicePaidStatus === 'Fully Paid' || invoiceOutstanding <= 0) {
    return 'kept';
  }

  // Check if PTP date has passed
  const ptpDate = new Date(commitment.commitmentDate);
  const today = new Date();
  
  // Set times to midnight for pure date comparison
  ptpDate.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  if (commitment.status === 'pending' && ptpDate < today) {
    return 'broken';
  }

  return commitment.status;
}

/**
 * Returns a human-readable badge configuration for commitment status.
 */
export function getStatusBadgeConfig(status: ARCollectionCommitment['status']) {
  switch (status) {
    case 'kept':
      return { label: 'Kept', className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' };
    case 'broken':
      return { label: 'Broken', className: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20 animate-pulse' };
    case 'rescheduled':
      return { label: 'Rescheduled', className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' };
    case 'waived':
      return { label: 'Waived', className: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20' };
    case 'pending':
    default:
      return { label: 'Pending', className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' };
  }
}

/**
 * Generates an SMS or Email outreach template for the salesman/customer.
 */
export function generateCollectionOutreach(
  customerName: string,
  invoiceNo: string,
  amount: number,
  ptpDate?: string
): string {
  const formattedAmount = `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;
  
  if (ptpDate) {
    const formattedDate = new Date(ptpDate).toLocaleDateString('en-PH', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
    return `Hi ${customerName}, this is a gentle reminder regarding Invoice #${invoiceNo} for ${formattedAmount}. We noted your commitment to settle this on or before ${formattedDate}. Thank you for your support!`;
  }
  
  return `Hi ${customerName}, we would like to follow up on the outstanding balance of ${formattedAmount} for Invoice #${invoiceNo}. May we ask when you plan to settle this? Thank you!`;
}
