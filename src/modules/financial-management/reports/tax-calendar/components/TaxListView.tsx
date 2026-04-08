import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { formatDate, deriveStatus } from '../utils';
import type { TaxActivity, TaxStatus } from '../types';

const PAGE_SIZE = 10;

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
  Monthly:   'bg-blue-50    text-blue-700    border-blue-200',
  Quarterly: 'bg-purple-50  text-purple-700  border-purple-200',
  Annually:  'bg-amber-50   text-amber-700   border-amber-200',
};

interface Props {
  activities: TaxActivity[];
  isFiltered: boolean;
  total:      number;
  onView:     (a: TaxActivity) => void;
}

export function TaxListView({ activities, isFiltered, total, onView }: Props) {
  const [page, setPage] = useState(1);
  const prevKeyRef = useRef(`${activities.length}`);

  useEffect(() => {
    const key = `${activities.length}`;
    if (prevKeyRef.current !== key) {
      prevKeyRef.current = key;
      if (page !== 1) setPage(1);
    }
  }, [activities.length, page]);

  const totalPages = Math.max(1, Math.ceil(activities.length / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages);
  const sliceStart = (safePage - 1) * PAGE_SIZE;
  const paginated  = activities.slice(sliceStart, sliceStart + PAGE_SIZE);

  return (
    <Card className="shadow-none border-border overflow-hidden">
      <CardHeader className="bg-muted/30 border-b border-border/50 pb-3">
        <CardTitle className="text-sm font-bold uppercase">List View</CardTitle>
      </CardHeader>

      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="text-xs font-bold py-4 pl-6">Due Date</TableHead>
                <TableHead className="text-xs font-bold py-4">Form No.</TableHead>
                <TableHead className="text-xs font-bold py-4">Tax Type</TableHead>
                <TableHead className="text-xs font-bold py-4">Description</TableHead>
                <TableHead className="text-xs font-bold py-4">Frequency</TableHead>
                <TableHead className="text-xs font-bold py-4">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-muted-foreground text-sm">
                    {isFiltered
                      ? 'No tax activities match the selected filters.'
                      : 'No tax activities yet.'}
                  </TableCell>
                </TableRow>
              ) : (
                paginated.map((a) => (
                  <TableRow key={a.id} className="border-border/40 hover:bg-muted/20">
                    <TableCell className="text-xs py-4 pl-6 font-medium whitespace-nowrap">
                      {formatDate(a.due_date)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground py-4 whitespace-nowrap">
                      {a.bir_form || '—'}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground py-4">
                      <span className="block max-w-[150px] truncate" title={a.tax_type}>
                        {a.tax_type}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground py-4">
                      <span className="block max-w-[150px] truncate" title={a.description || ''}>
                        {a.description || '—'}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs py-4">
                      {a.filing_frequency
                        ? <Badge variant="outline" className={`text-xs font-semibold ${FREQUENCY_STYLE[a.filing_frequency] || 'text-muted-foreground'}`}>{a.filing_frequency}</Badge>
                        : '—'}
                    </TableCell>
                    <TableCell className="text-xs py-4">
                      <Badge variant="outline" className={`text-xs font-semibold ${STATUS_STYLE[deriveStatus(a)]}`}>
                        {STATUS_LABEL[deriveStatus(a)]}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-center px-6 py-4 border-t border-border/50 gap-2">
            <button disabled={safePage === 1} onClick={() => setPage(p => p - 1)}
              className="flex items-center gap-1 text-sm text-foreground disabled:text-muted-foreground/40 disabled:cursor-not-allowed hover:text-foreground/70 transition-colors px-1">
              <ChevronLeft className="h-4 w-4" /> Previous
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(p => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
                .reduce<(number | '…')[]>((acc, p, idx, arr) => {
                  if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push('…');
                  acc.push(p);
                  return acc;
                }, [])
                .map((p, idx) => p === '…'
                  ? <span key={`e-${idx}`} className="px-2 text-sm text-muted-foreground">…</span>
                  : <button key={p} onClick={() => setPage(p as number)}
                      className={safePage === p
                        ? 'h-8 w-8 text-sm font-medium rounded border border-border bg-background text-foreground shadow-sm'
                        : 'h-8 w-8 text-sm text-foreground/70 hover:text-foreground transition-colors'}>
                      {p}
                    </button>
                )}
            </div>
            <button disabled={safePage === totalPages} onClick={() => setPage(p => p + 1)}
              className="flex items-center gap-1 text-sm text-foreground disabled:text-muted-foreground/40 disabled:cursor-not-allowed hover:text-foreground/70 transition-colors px-1">
              Next <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}