// WorklistTable.tsx
import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { CollectionsMergedRow } from '../types';
import { formatPeso, formatDate } from '../../accounts-receivable/utils';
import { getStatusBadgeConfig, generateCollectionOutreach } from '../utils/commitmentHelpers';
import { getCollectionUrgencyScore } from '../utils/riskPriority';
import { CalendarPlus, ClipboardList, Check, X, AlertTriangle, Copy, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { Invoice } from '../../accounts-receivable/types';

interface WorklistTableProps {
  rows: CollectionsMergedRow[];
  loading: boolean;
  onLogCommitment: (invoice: CollectionsMergedRow['invoice']) => void;
  onUpdateStatus: (commitmentId: string, status: 'kept' | 'broken') => void;
  onViewNotes: (invoiceNo: string, customerName: string) => void;
  onViewTemplates: (invoice: Invoice, commitment: CollectionsMergedRow['commitment']) => void;
}

export function WorklistTable({
  rows,
  loading,
  onLogCommitment,
  onUpdateStatus,
  onViewNotes,
  onViewTemplates,
}: WorklistTableProps) {
  
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleCopyOutreach = (row: CollectionsMergedRow) => {
    const ptpDate = row.commitment?.commitmentDate;
    const text = generateCollectionOutreach(
      row.invoice.customer,
      row.invoice.invoiceNo,
      row.commitment?.committedAmount || row.invoice.outstanding,
      ptpDate
    );
    navigator.clipboard.writeText(text);
    toast.success('Collection template copied to clipboard!');
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 border border-dashed rounded-xl">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <span className="text-xs text-muted-foreground">Merging AR invoices with PTP registry...</span>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="text-center py-16 border border-dashed rounded-xl text-xs text-muted-foreground">
        No records found matching filters.
      </div>
    );
  }

  return (
    <Card className="border border-border/50 bg-card/45 backdrop-blur-md shadow-sm overflow-hidden">
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="text-[10px] font-bold uppercase tracking-wider h-9">Urgency</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-wider h-9">Invoice</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-wider h-9">Customer</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-wider h-9">Salesman</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-wider h-9 text-right">Invoice Amt</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-wider h-9 text-right">Outstanding</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-wider h-9">PTP Date</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-wider h-9">Commitment</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-wider h-9">Status</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-wider h-9 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, idx) => {
                const { invoice, commitment, notesCount } = row;
                const urgency = getCollectionUrgencyScore(row);
                
                // Color code urgency cell
                let urgencyColorClass = 'text-muted-foreground';
                if (urgency >= 75) urgencyColorClass = 'text-rose-600 dark:text-rose-400 font-extrabold';
                else if (urgency >= 50) urgencyColorClass = 'text-amber-600 dark:text-amber-400 font-bold';

                const todayStr = new Date().toISOString().split('T')[0];
                const isMissed = commitment && commitment.status === 'pending' && commitment.commitmentDate < todayStr;
                const ptpConfig = commitment ? getStatusBadgeConfig(commitment.status) : null;

                return (
                  <TableRow
                    key={invoice.id || `${invoice.invoiceNo}-${idx}`}
                    className={`hover:bg-muted/30 transition-colors ${
                      isMissed ? 'bg-rose-500/5 hover:bg-rose-500/10 border-l-2 border-l-rose-500 dark:bg-rose-950/10' : ''
                    }`}
                  >
                    {/* Urgency */}
                    <TableCell className="py-2.5">
                      <span className={`text-[10px] tabular-nums ${urgencyColorClass}`}>
                        {urgency}%
                      </span>
                    </TableCell>

                    {/* Invoice */}
                    <TableCell className="py-2.5">
                      <div className="font-bold text-xs text-foreground">{invoice.invoiceNo}</div>
                      <div className="text-[9px] text-muted-foreground">Due {formatDate(invoice.due)}</div>
                    </TableCell>

                    {/* Customer */}
                    <TableCell className="py-2.5">
                      <div className="font-bold text-xs text-foreground truncate max-w-[160px]" title={invoice.customer}>
                        {invoice.customer}
                      </div>
                      <div className="text-[9px] text-muted-foreground">{invoice.customerCode}</div>
                    </TableCell>

                    {/* Salesman */}
                    <TableCell className="py-2.5">
                      <div className="text-xs text-foreground truncate max-w-[130px]">{invoice.salesman}</div>
                    </TableCell>

                    {/* Invoice Amt */}
                    <TableCell className="py-2.5 text-right font-medium text-xs text-muted-foreground/80 tabular-nums">
                      {formatPeso(invoice.netReceivable)}
                    </TableCell>

                    {/* Outstanding */}
                    <TableCell className="py-2.5 text-right font-bold text-xs text-foreground tabular-nums">
                      {formatPeso(invoice.outstanding)}
                    </TableCell>

                    {/* PTP Date */}
                    <TableCell className="py-2.5 text-xs">
                      {commitment ? (
                        <span className="font-semibold text-foreground flex items-center gap-1">
                          {isMissed && <AlertTriangle className="h-3.5 w-3.5 text-rose-500 shrink-0" />}
                          {formatDate(commitment.commitmentDate)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/50">—</span>
                      )}
                    </TableCell>

                    {/* Committed Amount */}
                    <TableCell className="py-2.5 text-xs text-foreground tabular-nums">
                      {commitment ? (
                        <span className="font-bold">{formatPeso(commitment.committedAmount)}</span>
                      ) : (
                        <span className="text-muted-foreground/50">—</span>
                      )}
                    </TableCell>

                    {/* Status Badge */}
                    <TableCell className="py-2.5">
                      {ptpConfig ? (
                        <Badge className={`text-[9px] font-bold px-2 py-0.5 border ${ptpConfig.className}`}>
                          {ptpConfig.label}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[9px] font-medium text-muted-foreground/60 border-muted-foreground/20">
                          Unassigned
                        </Badge>
                      )}
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Discussion / Call Logs */}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-purple-600 relative"
                          onClick={() => onViewNotes(invoice.invoiceNo, invoice.customer)}
                          title="View Discussion Logs"
                        >
                          <MessageSquare className="h-3.5 w-3.5" />
                          {notesCount > 0 && (
                            <span className="absolute -top-0.5 -right-0.5 bg-purple-600 text-white rounded-full text-[7px] w-3 h-3 flex items-center justify-center font-bold">
                              {notesCount}
                            </span>
                          )}
                        </Button>

                        {/* Outreach Copy button */}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          onClick={() => onViewTemplates(invoice, commitment)}
                          title="Outreach Templates"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>

                        {/* Log PTP button */}
                        {!commitment ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-[10px] px-2.5 gap-1 border-purple-500/20 text-purple-600 dark:text-purple-400 hover:bg-purple-500/10"
                            onClick={() => onLogCommitment(invoice)}
                          >
                            <CalendarPlus className="h-3.5 w-3.5" />
                            Log PTP
                          </Button>
                        ) : commitment.status === 'pending' ? (
                          <div className="flex gap-1">
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-7 w-7 border-emerald-500/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
                              onClick={() => onUpdateStatus(commitment.id, 'kept')}
                              title="Mark Kept"
                            >
                              <Check className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-7 w-7 border-rose-500/20 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10"
                              onClick={() => onUpdateStatus(commitment.id, 'broken')}
                              title="Mark Broken"
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-[10px] px-2 gap-1 text-muted-foreground"
                            onClick={() => onLogCommitment(invoice)}
                          >
                            <ClipboardList className="h-3.5 w-3.5" />
                            Re-PTP
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
