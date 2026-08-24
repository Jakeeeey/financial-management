// InvoiceNotesDrawer.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { MessageSquare, PhoneCall, AlertTriangle, CheckCircle, FileText, Send } from 'lucide-react';
import { ARCollectionNote } from '../types';

interface InvoiceNotesDrawerProps {
  invoiceNo: string;
  customerName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNoteAdded?: () => void;
}

export function InvoiceNotesDrawer({
  invoiceNo,
  customerName,
  open,
  onOpenChange,
  onNoteAdded,
}: InvoiceNotesDrawerProps) {
  const [notes, setNotes] = useState<ARCollectionNote[]>([]);
  const [loading, setLoading] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [noteType, setNoteType] = useState<ARCollectionNote['noteType']>('call_log');
  const [submitting, setSubmitting] = useState(false);

  const fetchNotes = useCallback(async () => {
    if (!invoiceNo) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/fm/accounting/ar-collections?view=notes&invoiceNo=${encodeURIComponent(invoiceNo)}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to load notes');
      const data = await res.json();
      setNotes(data.notes || []);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load discussion logs.');
    } finally {
      setLoading(false);
    }
  }, [invoiceNo]);

  useEffect(() => {
    if (open) {
      fetchNotes();
      setNoteText('');
      setNoteType('call_log');
    }
  }, [open, fetchNotes]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteText.trim()) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/fm/accounting/ar-collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'addNote',
          invoiceNo,
          noteType,
          noteText: noteText.trim(),
        }),
      });

      if (!res.ok) throw new Error('Failed to save note');
      
      toast.success('Activity logged successfully!');
      setNoteText('');
      fetchNotes();
      onNoteAdded?.();
    } catch {
      toast.error('Failed to save log entry.');
    } finally {
      setSubmitting(false);
    }
  };

  const getNoteIcon = (type: ARCollectionNote['noteType']) => {
    switch (type) {
      case 'call_log':
        return <PhoneCall className="h-3 w-3 text-blue-500" />;
      case 'promise':
        return <FileText className="h-3 w-3 text-purple-500" />;
      case 'escalation':
        return <AlertTriangle className="h-3 w-3 text-rose-500" />;
      case 'resolution':
        return <CheckCircle className="h-3 w-3 text-emerald-500" />;
      case 'remark':
      default:
        return <MessageSquare className="h-3 w-3 text-muted-foreground" />;
    }
  };

  const getNoteBadgeConfig = (type: ARCollectionNote['noteType']) => {
    switch (type) {
      case 'call_log':
        return { label: 'Call Log', className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' };
      case 'promise':
        return { label: 'Promise', className: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20' };
      case 'escalation':
        return { label: 'Escalation', className: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20' };
      case 'resolution':
        return { label: 'Resolved', className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' };
      case 'remark':
      default:
        return { label: 'Remark', className: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20' };
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-[420px] flex flex-col h-full p-6">
        <SheetHeader className="border-b pb-4 shrink-0">
          <SheetTitle className="text-sm font-bold flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-purple-600" />
            Discussion & Call Logs
          </SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground">
            Invoice #{invoiceNo} · Customer: {customerName}
          </SheetDescription>
        </SheetHeader>

        {/* Timeline View */}
        <ScrollArea className="flex-1 -mx-6 px-6 py-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-2">
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <span className="text-[10px] text-muted-foreground">Loading log entries...</span>
            </div>
          ) : notes.length === 0 ? (
            <div className="text-center py-16 text-xs text-muted-foreground border border-dashed rounded-xl p-6">
              No logged activities yet. Call the customer/salesman and log your first check-in!
            </div>
          ) : (
            <div className="relative border-l border-border/60 pl-4 ml-2 space-y-5 py-2">
              {notes.map((note, idx) => {
                const badge = getNoteBadgeConfig(note.noteType);
                const formattedDate = new Date(note.createdAt).toLocaleDateString('en-PH', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                });

                return (
                  <div key={note.id || `note-${idx}`} className="relative space-y-1">
                    {/* Circle marker */}
                    <div className="absolute -left-[23px] top-1 bg-background border rounded-full p-1 shadow-sm">
                      {getNoteIcon(note.noteType)}
                    </div>

                    <div className="flex justify-between items-center gap-2">
                      <span className="text-[9px] font-black text-foreground truncate max-w-[130px]">{note.createdBy}</span>
                      <span className="text-[8px] text-muted-foreground">{formattedDate}</span>
                    </div>

                    <div className="p-3 bg-muted/20 border border-border/40 rounded-xl space-y-1.5 shadow-sm">
                      <div className="flex justify-between items-center">
                        <Badge className={`text-[8px] font-black px-1.5 py-0.5 border ${badge.className}`}>
                          {badge.label}
                        </Badge>
                      </div>
                      <p className="text-[10px] text-foreground/80 leading-relaxed font-medium whitespace-pre-wrap">
                        {note.noteText}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {/* Input area at bottom */}
        <form onSubmit={handleSubmit} className="border-t pt-4 space-y-3 shrink-0">
          <div className="flex items-center justify-between gap-3">
            <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Log Activity</Label>
            <Select value={noteType} onValueChange={(val) => setNoteType(val as ARCollectionNote['noteType'])}>
              <SelectTrigger className="h-7 w-[120px] text-[10px]">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="call_log" className="text-[10px]">📞 Phone Call</SelectItem>
                <SelectItem value="promise" className="text-[10px]">📝 Promise</SelectItem>
                <SelectItem value="escalation" className="text-[10px]">⚠️ Escalation</SelectItem>
                <SelectItem value="resolution" className="text-[10px]">✅ Resolution</SelectItem>
                <SelectItem value="remark" className="text-[10px]">💬 Remark</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="relative">
            <Textarea
              placeholder="Type discussion notes or call results..."
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              className="min-h-[70px] text-[11px] placeholder:text-muted-foreground/50 pr-10"
              required
            />
            <Button
              type="submit"
              size="icon"
              disabled={submitting || !noteText.trim()}
              className="absolute right-2 bottom-2 h-7 w-7 bg-purple-600 hover:bg-purple-700 text-white shadow"
            >
              <Send className="h-3.5 w-3.5" />
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
