"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn, formatNumber } from "@/lib/utils";

/** Rows-per-page choices every Bank Management V2 list offers. */
export const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;

/** `0` means "All": every row on one page. */
export const ALL_PAGE_SIZE = 0;

export function readPageSize(storageKey: string, fallback: number = PAGE_SIZE_OPTIONS[0]): number {
  if (typeof window === "undefined") return fallback;
  try {
    const stored = window.localStorage.getItem(storageKey);
    if (stored === null) return fallback;
    const size = Number(stored);
    return Number.isFinite(size) && size >= 0 ? size : fallback;
  } catch {
    return fallback;
  }
}

export function persistPageSize(storageKey: string, size: number): void {
  try {
    window.localStorage.setItem(storageKey, String(size));
  } catch {
    // Private browsing: the list still works, it just forgets the choice.
  }
}

/**
 * Rows-per-page state that survives a reload. The caller resets its page number when the
 * size changes; the read runs after mount so the server render and the first client render agree.
 */
export function usePageSize(storageKey: string, fallback: number = PAGE_SIZE_OPTIONS[0]) {
  const [pageSize, setPageSizeState] = useState(fallback);

  useEffect(() => {
    setPageSizeState(readPageSize(storageKey, fallback));
  }, [storageKey, fallback]);

  const setPageSize = useCallback(
    (size: number) => {
      setPageSizeState(size);
      persistPageSize(storageKey, size);
    },
    [storageKey],
  );

  return [pageSize, setPageSize] as const;
}

/** Page count for a client-paginated list; `ALL_PAGE_SIZE` keeps everything on page 1. */
export function pageCountFor(total: number, pageSize: number): number {
  return pageSize > 0 ? Math.max(1, Math.ceil(total / pageSize)) : 1;
}

/** The rows for a page, clamped so a shorter list never renders an empty page. */
export function pageSlice<T>(rows: T[], page: number, pageSize: number): T[] {
  if (pageSize <= 0) return rows;
  const safe = Math.min(Math.max(page, 1), pageCountFor(rows.length, pageSize));
  const start = (safe - 1) * pageSize;
  return rows.slice(start, start + pageSize);
}

type Props = {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  /** Enables the rows-per-page selector. */
  onPageSizeChange?: (pageSize: number) => void;
  /** Extra choices; the movement log passes 100 because its route caps there. */
  pageSizeOptions?: readonly number[];
  /** Appends the "All" choice. Turn it off for server-paginated lists. */
  allowAll?: boolean;
  isLoading?: boolean;
  className?: string;
};

/**
 * The one pager for every Bank Management V2 list.
 *
 * The range line stays on a single page; the arrows and the page box only appear when there is
 * somewhere to go, so a short list never shows a dead pager. The box is a live input: type a page
 * and press Enter (or leave the field) to jump there.
 */
export function TablePager({
  page,
  pageCount,
  total,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = PAGE_SIZE_OPTIONS,
  allowAll = true,
  isLoading,
  className,
}: Props) {
  const safePage = Math.min(Math.max(page, 1), Math.max(pageCount, 1));
  const [draft, setDraft] = useState(String(safePage));

  useEffect(() => {
    setDraft(String(safePage));
  }, [safePage]);

  if (total === 0) return null;

  const effectiveSize = pageSize > 0 ? pageSize : total;
  const first = (safePage - 1) * effectiveSize + 1;
  const last = Math.min(safePage * effectiveSize, total);

  const sizes = [...pageSizeOptions];
  if (pageSize > 0 && !sizes.includes(pageSize)) sizes.push(pageSize);
  sizes.sort((a, b) => a - b);

  function commit() {
    const wanted = Number(draft);
    if (!Number.isFinite(wanted) || wanted < 1) {
      setDraft(String(safePage));
      return;
    }
    const target = Math.min(Math.round(wanted), pageCount);
    setDraft(String(target));
    if (target !== safePage) onPageChange(target);
  }

  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground", className)}>
      <span aria-live="polite">
        Showing {formatNumber(first)}–{formatNumber(last)} of {formatNumber(total)}
      </span>

      <div className="flex flex-wrap items-center gap-3">
        {onPageSizeChange ? (
          <label className="flex items-center gap-2 text-xs">
            <span className="whitespace-nowrap">Rows per page</span>
            <Select
              value={pageSize === ALL_PAGE_SIZE ? "all" : String(pageSize)}
              onValueChange={(value) => onPageSizeChange(value === "all" ? ALL_PAGE_SIZE : Number(value))}
            >
              <SelectTrigger className="h-8 w-[84px]" aria-label="Rows per page">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {sizes.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
                {allowAll ? <SelectItem value="all">All</SelectItem> : null}
              </SelectContent>
            </Select>
          </label>
        ) : null}

        {pageCount > 1 && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              aria-label="Previous page"
              disabled={safePage <= 1 || isLoading}
              onClick={() => onPageChange(safePage - 1)}
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </Button>
            <span className="flex items-center gap-1">
              <Input
                inputMode="numeric"
                aria-label="Page number"
                className="h-8 w-12 px-1 text-center tabular-nums"
                value={draft}
                disabled={isLoading}
                onChange={(event) => setDraft(event.target.value.replace(/[^\d]/g, ""))}
                onBlur={commit}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    commit();
                  }
                }}
              />
              <span className="whitespace-nowrap tabular-nums">of {pageCount}</span>
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              aria-label="Next page"
              disabled={safePage >= pageCount || isLoading}
              onClick={() => onPageChange(safePage + 1)}
            >
              <ChevronRight className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
