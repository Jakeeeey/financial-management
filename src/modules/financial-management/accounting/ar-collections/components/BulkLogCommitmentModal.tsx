// BulkLogCommitmentModal.tsx
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { useCommitmentActions } from '../hooks/useCommitmentActions';
import { UserCheck, X } from 'lucide-react';

interface SalesmanItem {
  id: number;
  name: string;
  code: string;
  label: string;
}

interface BulkLogCommitmentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  initialSalesmanCode?: string | null;
}

export function BulkLogCommitmentModal({
  open,
  onOpenChange,
  onSuccess,
  initialSalesmanCode,
}: BulkLogCommitmentModalProps) {
  const [selectedSalesmanId, setSelectedSalesmanId] = useState<string>('');
  const [commitmentDate, setCommitmentDate] = useState<string>('');
  const [noteText, setNoteText] = useState<string>('');
  const [fullSalesmenList, setFullSalesmenList] = useState<SalesmanItem[]>([]);
  const [prevOpen, setPrevOpen] = useState(false);

  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setNoteText('');
      const defaultPtp = new Date();
      defaultPtp.setDate(defaultPtp.getDate() + 7);
      setCommitmentDate(defaultPtp.toISOString().split('T')[0]);
    }
  }

  const { logSalesmanCommitment, submitting } = useCommitmentActions(() => {
    onSuccess?.();
    onOpenChange(false);
  });

  useEffect(() => {
    if (open) {
      // Fetch all active salesmen from API
      fetch('/api/fm/accounting/ar-collections?view=salesmen-list')
        .then(res => res.json())
        .then(data => {
          const list: SalesmanItem[] = data.salesmen || [];
          setFullSalesmenList(list);

          // Pre-select based on initialSalesmanCode if provided
          if (initialSalesmanCode) {
            const matched = list.find((s) => s.code === initialSalesmanCode);
            if (matched) {
              setSelectedSalesmanId(String(matched.id));
              return;
            }
          }
          
          if (list.length > 0) {
            setSelectedSalesmanId(String(list[0].id));
          }
        })
        .catch(err => console.error('Failed to load salesmen list:', err));
    }
  }, [open, initialSalesmanCode]);

  // Lock parent page body scrolling when modal is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSalesmanId || !commitmentDate) return;

    await logSalesmanCommitment({
      salesmanId: Number(selectedSalesmanId),
      commitmentDate,
      noteText: noteText.trim(),
    });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs transition-opacity duration-200">
      {/* Click outside overlay to close */}
      <div className="absolute inset-0" onClick={() => onOpenChange(false)} />
      
      {/* Modal Container */}
      <div className="relative z-10 w-full max-w-[420px] bg-background border border-border/85 rounded-2xl shadow-xl flex flex-col max-h-[90vh] overflow-hidden transition-transform duration-200">
        {/* Header */}
        <div className="p-5 border-b border-border/50 shrink-0 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold flex items-center gap-2 text-foreground">
              <UserCheck className="h-4 w-4 text-purple-600 animate-pulse" />
              Log Salesman Commitments
            </h3>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Select a salesman and a commitment date. This will automatically apply to all of their outstanding AR invoices.
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-lg hover:bg-muted text-muted-foreground shrink-0"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="space-y-1">
            <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Responsible Salesman</Label>
            <SearchableSelect
              value={selectedSalesmanId}
              onValueChange={setSelectedSalesmanId}
              placeholder="Select Salesman"
              className="h-8 text-[11px]"
              options={fullSalesmenList.map((s) => ({ value: String(s.id), label: s.label }))}
            />
          </div>

          <div className="space-y-1">
            <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Commitment Date (PTP)</Label>
            <Input
              type="date"
              value={commitmentDate}
              onChange={(e) => setCommitmentDate(e.target.value)}
              className="h-8 text-[11px]"
              required
            />
          </div>

          <div className="space-y-1">
            <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Notes / Discussion Details</Label>
            <Textarea
              placeholder="e.g. Salesman confirms check collection on next visit..."
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              className="min-h-[70px] text-[11px]"
            />
          </div>

          <div className="pt-3 border-t flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-8 text-[11px]"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={submitting || !selectedSalesmanId}
              className="h-8 text-[11px] bg-purple-600 hover:bg-purple-700 text-white font-bold"
            >
              {submitting ? 'Saving...' : 'Log Commitments'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
