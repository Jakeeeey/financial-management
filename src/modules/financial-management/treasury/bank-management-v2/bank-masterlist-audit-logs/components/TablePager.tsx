"use client";

import { Button } from "@/components/ui/button";
import { cn, formatNumber } from "@/lib/utils";

import { LIST_PAGE_SIZE } from "../constants";

type Props = {
  page: number;
  pageCount: number;
  total: number;
  /** Rows actually rendered on this page, so the range stays honest on a short last page. */
  shown: number;
  onPageChange: (page: number) => void;
  className?: string;
};

/**
 * Client-side pager shared by the masterlist and findings tables.
 *
 * The count line stays on a single page; the buttons only appear when there is somewhere
 * to go, so a short list never shows a dead pager.
 */
export function TablePager({ page, pageCount, total, shown, onPageChange, className }: Props) {
  if (total === 0 || shown === 0) return null;
  const first = (page - 1) * LIST_PAGE_SIZE + 1;

  return (
    <div className={cn("flex items-center justify-between gap-3 text-sm text-muted-foreground", className)}>
      <span aria-live="polite">
        Showing {formatNumber(first)}–{formatNumber(first + shown - 1)} of {formatNumber(total)}
      </span>
      {pageCount > 1 && (
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
            Previous
          </Button>
          <Button variant="outline" size="sm" disabled={page >= pageCount} onClick={() => onPageChange(page + 1)}>
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
