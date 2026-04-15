"use client";
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { formatDateTime, deriveStatus, daysUntil } from '../utils';
import type { TaxActivity, TaxStatus } from '../types';

interface Props {
  open:    boolean;
  onClose: () => void;
  item:    TaxActivity | null;
  onEdit:  (item: TaxActivity) => void;
}

const STATUS_STYLE: Record<TaxStatus, string> = {
  FILED:    'bg-emerald-50 text-emerald-700 border-emerald-200',
  PAID:     'bg-blue-50    text-blue-700    border-blue-200',
  OVERDUE:  'bg-red-50     text-red-700     border-red-200',
  UPCOMING: 'bg-amber-50   text-amber-700   border-amber-200',
  PENDING:  'bg-gray-50    text-gray-600    border-gray-200',
};

const STATUS_LABEL: Record<TaxStatus, string> = {
  FILED:    'Filed',
  PAID:     'Paid',
  OVERDUE:  'Overdue',
  UPCOMING: 'Upcoming',
  PENDING:  'Pending',
};

const FREQUENCY_STYLE: Record<string, string> = {
  Monthly:   'bg-indigo-50 text-indigo-700 border-indigo-200',
  Quarterly: 'bg-teal-50   text-teal-700   border-teal-200',
  Annually:  'bg-rose-50   text-rose-700   border-rose-200',
};

const Field = ({ label, value }: { label: string; value?: string | React.ReactNode }) => (
  <div className="py-2 border-b border-border/30 last:border-b-0">
    <div className="text-xs font-medium text-muted-foreground mb-1">{label}</div>
    <div className="text-sm font-medium text-foreground break-words">{value || '—'}</div>
  </div>
);

export function TaxViewDialog({ open, onClose, item, onEdit }: Props) {
  if (!item) return null;

  const derived  = deriveStatus(item);
  const days     = daysUntil(item.due_date);
  const isSettled = derived === 'FILED' || derived === 'PAID';

  const daysLabel = isSettled
    ? '—'
    : derived === 'OVERDUE'
    ? `${Math.abs(days)} day${Math.abs(days) !== 1 ? 's' : ''} overdue`
    : `${days} day${days !== 1 ? 's' : ''} remaining`;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="text-base font-bold">Tax Activity Details</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto overflow-x-hidden py-2 px-1">
          <div className="space-y-1">
            <Field label="Title"          value={item.title} />
            <Field label="Tax Type"       value={item.tax_type} />
            <Field label="Description"    value={item.description} />
            <Field
              label="Filing Frequency"
              value={
                item.filing_frequency ? (
                  <Badge variant="outline" className={`text-xs font-semibold ${FREQUENCY_STYLE[item.filing_frequency] || 'text-muted-foreground'}`}>
                    {item.filing_frequency}
                  </Badge>
                ) : undefined
              }
            />
            <Field label="BIR Form"       value={item.bir_form} />
            <Field label="Due Date Rule"  value={item.due_date_rule} />
            <Field label="Due Date"       value={formatDateTime(item.due_date)} />
            <Field label="Filing Date"    value={formatDateTime(item.actual_filing_date)} />
            <Field label="Payment Date"   value={formatDateTime(item.payment_date)} />
            <Field
              label="Amount Paid"
              value={
                item.amount_paid
                  ? `₱${Number(item.amount_paid).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  : undefined
              }
            />
            <Field label="Days Until Due" value={daysLabel} />
            <Field
              label="Status"
              value={
                <Badge variant="outline" className={`text-xs font-semibold ${STATUS_STYLE[derived]}`}>
                  {STATUS_LABEL[derived]}
                </Badge>
              }
            />
            <Field label="Reminder Date"  value={formatDateTime(item.reminder_date)} />
            <Field label="Created"        value={formatDateTime(item.created_at)} />
            <Field label="Last Updated"   value={formatDateTime(item.updated_at)} />
          </div>
        </div>

        <DialogFooter className="flex-shrink-0 pt-2 border-t border-border/50">
          <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
          <Button size="sm" onClick={() => { onEdit(item); onClose(); }}>Edit</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}