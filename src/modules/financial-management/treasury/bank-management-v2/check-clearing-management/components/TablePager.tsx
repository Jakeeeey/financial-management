"use client";

import { Button } from "@/components/ui/button";
import { cn, formatNumber } from "@/lib/utils";

type Props = {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  isLoading?: boolean;
  className?: string;
};

/**
 * The one pager for every Bank Management V2 list.
 *
 * The range line stays on a single page; the buttons only appear when there is somewhere
 * to go, so a short list never shows a dead pager.
 */
export function TablePager({ page, pageCount, total, pageSize, onPageChange, isLoading, className }: Props) {
  if (total === 0) return null;

  const safePage = Math.min(Math.max(page, 1), Math.max(pageCount, 1));
  const first = (safePage - 1) * pageSize + 1;
  const last = Math.min(safePage * pageSize, total);

  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground", className)}>
      <span aria-live="polite">
        Showing {formatNumber(first)}–{formatNumber(last)} of {formatNumber(total)}
      </span>
      {pageCount > 1 && (
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={safePage <= 1 || isLoading}
            onClick={() => onPageChange(safePage - 1)}
          >
            Previous
          </Button>
          <span className="tabular-nums">
            Page {safePage} of {pageCount}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={safePage >= pageCount || isLoading}
            onClick={() => onPageChange(safePage + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
