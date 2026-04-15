// tax-calendar/components/TaxFormDialog.tsx
"use client";
import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { TAX_TYPES, FILING_FREQUENCIES } from '../types';
import type { TaxActivityForm, FilingFrequency } from '../types';

interface Props {
  open:    boolean;
  onClose: () => void;
  onSave:  (form: TaxActivityForm) => void;
  initial: TaxActivityForm;
  loading: boolean;
  title:   string;
}

const Field = ({ label, required, children }: {
  label: string; required?: boolean; children: React.ReactNode
}) => (
  <div className="space-y-1.5">
    <label className="text-xs font-medium text-muted-foreground">
      {label}{required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
    {children}
  </div>
);

export function TaxFormDialog({ open, onClose, onSave, initial, loading, title }: Props) {
  const [form, setForm] = useState<TaxActivityForm>(initial);

  const prevOpenRef = useRef(false);
  useEffect(() => {
    if (open && !prevOpenRef.current) setForm(initial);
    prevOpenRef.current = open;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const set = (k: keyof TaxActivityForm, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  const valid = form.title.trim() && form.tax_type && form.due_date;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="text-base font-bold">{title}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-5 py-2 pr-1 pl-1">
          <Field label="Title" required>
            <Input
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="e.g. Monthly VAT Filing"
              className="text-sm"
            />
          </Field>

          <Field label="Tax Type" required>
            <Select value={form.tax_type} onValueChange={(v) => set('tax_type', v)}>
              <SelectTrigger className="text-sm">
                <SelectValue placeholder="Select tax type" />
              </SelectTrigger>
              <SelectContent>
                {TAX_TYPES.map((t) => (
                  <SelectItem key={t} value={t} className="text-sm">{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Filing Frequency" required>
            <Select value={form.filing_frequency} onValueChange={(v) => set('filing_frequency', v as FilingFrequency)}>
              <SelectTrigger className="text-sm">
                <SelectValue placeholder="Select frequency" />
              </SelectTrigger>
              <SelectContent>
                {FILING_FREQUENCIES.map((f) => (
                  <SelectItem key={f} value={f} className="text-sm">{f}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          {/* Due Date — full width now that Status dropdown is removed */}
          <Field label="Due Date" required>
            <Input
              type="datetime-local"
              value={form.due_date}
              onChange={(e) => set('due_date', e.target.value)}
              className="text-sm"
            />
          </Field>

          <Field label="Reminder Date">
            <Input
              type="datetime-local"
              value={form.reminder_date}
              onChange={(e) => set('reminder_date', e.target.value)}
              className="text-sm"
            />
          </Field>

          <Field label="BIR Form">
            <Input
              value={form.bir_form}
              onChange={(e) => set('bir_form', e.target.value)}
              placeholder="e.g. 2550M, 1601C"
              className="text-sm"
            />
          </Field>

          <Field label="Due Date Rule">
            <Input
              value={form.due_date_rule}
              onChange={(e) => set('due_date_rule', e.target.value)}
              placeholder="e.g. 20th of every month"
              className="text-sm"
            />
          </Field>

          <Field label="Description">
            <Textarea
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="Optional notes…"
              rows={4}
              className="text-sm resize-none max-h-40 overflow-y-auto"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Filing Date">
              <Input
                type="datetime-local"
                value={form.actual_filing_date}
                onChange={(e) => set('actual_filing_date', e.target.value)}
                className="text-sm"
              />
            </Field>
            <Field label="Payment Date">
              <Input
                type="datetime-local"
                value={form.payment_date}
                onChange={(e) => set('payment_date', e.target.value)}
                className="text-sm"
              />
            </Field>
          </div>

          <Field label="Amount Paid">
            <Input
              type="number"
              step="0.01"
              value={form.amount_paid}
              onChange={(e) => set('amount_paid', e.target.value)}
              placeholder="0.00"
              className="text-sm"
            />
          </Field>
        </div>

        <DialogFooter className="flex-shrink-0 pt-2 border-t border-border/50">
          <Button variant="outline" size="sm" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button size="sm" onClick={() => onSave(form)} disabled={!valid || loading}>
            {loading ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}