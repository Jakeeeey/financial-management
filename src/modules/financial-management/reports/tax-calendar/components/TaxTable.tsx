import { useState, useRef, useEffect } from 'react';
// tax-calendar/components/TaxTable.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Pencil, Clock, FileText, CheckCircle2, AlertCircle, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatDate, getDaysLabel } from '../utils';
import { STATUS_STYLE } from '../types';
import type { TaxActivity, TaxStatus } from '../types';

const PAGE_SIZE = 10;

const STATUS_ICON: Record<TaxStatus, React.ReactNode> = {
  PENDING: <Clock        className="h-3 w-3" />,
  FILED:   <FileText     className="h-3 w-3" />,
  PAID:    <CheckCircle2 className="h-3 w-3" />,
  OVERDUE: <AlertCircle  className="h-3 w-3" />,
};

interface Props {
  activities: TaxActivity[];
  isFiltered: boolean;
  total:      number;
  onEdit:     (a: TaxActivity) => void;
  search: string;
  onSearchChange: (value: string) => void;
}

export function TaxTable({
  activities,
  isFiltered,
  total,
  onEdit,
  search,
  onSearchChange,
}: Props) {
  const [page, setPage] = useState(1);

  // Track the previous activities key (length + search) so we can reset the page to 1 when data/search changes
  const prevKeyRef = useRef(`${activities.length}::${search}`);
  const currentKey = `${activities.length}::${search}`;

  useEffect(() => {
    if (prevKeyRef.current !== currentKey) {
      prevKeyRef.current = currentKey;
      if (page !== 1) setPage(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activities.length, search]);

  let safePage = page;

  const totalPages = Math.max(1, Math.ceil(activities.length / PAGE_SIZE));
  safePage         = Math.min(safePage, totalPages);
  const sliceStart = (safePage - 1) * PAGE_SIZE;
  const paginated  = activities.slice(sliceStart, sliceStart + PAGE_SIZE);

  return (
    <Card className="shadow-none border-border overflow-hidden">
      <CardHeader className="bg-muted/30 border-b border-border/50 pb-3 flex flex-row items-center justify-between gap-4">
        <CardTitle className="text-sm font-bold uppercase">Tax Activities</CardTitle>
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search title, tax type, created at…"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-9 pl-8 w-full text-xs"
          />
        </div>
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {isFiltered ? (
            <>{activities.length} of {total} result{activities.length !== 1 ? 's' : ''}</>
          ) : (
            <>{activities.length} result{activities.length !== 1 ? 's' : ''}</>
          )}
        </span>
      </CardHeader>

      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="text-xs font-bold py-4 pl-6">Title</TableHead>
                <TableHead className="text-xs font-bold py-4">Tax Type</TableHead>
                <TableHead className="text-xs font-bold py-4">Due Date</TableHead>
                <TableHead className="text-xs font-bold py-4">Reminder</TableHead>
                <TableHead className="text-xs font-bold py-4">Days Left</TableHead>
                <TableHead className="text-xs font-bold py-4">Created At</TableHead>
                <TableHead className="text-xs font-bold py-4">Updated At</TableHead>
                <TableHead className="text-xs font-bold py-4">Status</TableHead>
                <TableHead className="text-xs font-bold py-4 pr-6 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-10 text-muted-foreground text-sm">
                    {isFiltered
                      ? 'No tax activities match the selected filters.'
                      : 'No tax activities yet. Click "Add Tax Date" to get started.'}
                  </TableCell>
                </TableRow>
              ) : (
                paginated.map((a) => {
                  const { text: daysText, className: daysCls } = getDaysLabel(a);
                  return (
                    <TableRow key={a.id} className="border-border/40 hover:bg-muted/20">
                      <TableCell className="py-4 pl-6">
                        <div className="font-bold text-xs text-foreground">{a.title}</div>
                        {a.description && (
                          <div className="text-[11px] text-muted-foreground mt-0.5 max-w-[180px] truncate" title={a.description}>
                            {a.description}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground py-4">
                        <span className="block max-w-[150px] truncate" title={a.tax_type}>{a.tax_type}</span>
                      </TableCell>
                      <TableCell className="text-xs py-4 font-medium whitespace-nowrap">{formatDate(a.due_date)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground py-4 whitespace-nowrap">{formatDate(a.reminder_date)}</TableCell>
                      <TableCell className={`text-xs py-4 ${daysCls}`}>{daysText}</TableCell>
                      <TableCell className="text-xs text-muted-foreground py-4 whitespace-nowrap">{formatDate(a.created_at)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground py-4 whitespace-nowrap">{formatDate(a.updated_at)}</TableCell>
                      <TableCell className="py-4">
                        <Badge variant="outline" className={`text-[11px] font-semibold gap-1 ${STATUS_STYLE[a.status]}`}>
                          {STATUS_ICON[a.status]}
                          {a.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-4 pr-6">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button variant="ghost" size="sm"
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                            onClick={() => onEdit(a)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* ── Pagination footer ─────────────────────────────────────────────── */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center px-6 py-4 border-t border-border/50 gap-2">

            <button
              disabled={safePage === 1}
              onClick={() => setPage((p) => p - 1)}
              className="flex items-center gap-1 text-sm text-foreground disabled:text-muted-foreground/40 disabled:cursor-not-allowed hover:text-foreground/70 transition-colors px-1"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </button>

            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
                .reduce<(number | '…')[]>((acc, p, idx, arr) => {
                  if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push('…');
                  acc.push(p);
                  return acc;
                }, [])
                .map((p, idx) =>
                  p === '…' ? (
                    <span key={`ellipsis-${idx}`} className="px-2 text-sm text-muted-foreground">…</span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => setPage(p as number)}
                      className={
                        safePage === p
                          ? 'h-8 w-8 text-sm font-medium rounded border border-border bg-background text-foreground shadow-sm'
                          : 'h-8 w-8 text-sm text-foreground/70 hover:text-foreground transition-colors'
                      }
                    >
                      {p}
                    </button>
                  )
                )}
            </div>

            <button
              disabled={safePage === totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="flex items-center gap-1 text-sm text-foreground disabled:text-muted-foreground/40 disabled:cursor-not-allowed hover:text-foreground/70 transition-colors px-1"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}