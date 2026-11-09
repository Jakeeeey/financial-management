"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { PAGE_SIZE, toneClass } from "../constants";
import type { GroupAttentionItem } from "../types";
import { TablePager } from "./TablePager";

const SEVERITY_TONE = { CRITICAL: "danger", HIGH: "warning", MEDIUM: "info" } as const;

type FocusItem = GroupAttentionItem & { codes: string[] };

/**
 * Twelve of fourteen findings are one sentence with a different company in front, so identical
 * findings share a line and list the companies they apply to.
 */
function collapseCodes(items: GroupAttentionItem[]): FocusItem[] {
  const groups = new Map<string, FocusItem>();
  for (const item of items) {
    const key = `${item.severity}|${item.title}|${item.detail}`;
    const existing = groups.get(key);
    if (existing) {
      if (item.companyCode !== "—" && !existing.codes.includes(item.companyCode)) {
        existing.codes.push(item.companyCode);
      }
      continue;
    }
    groups.set(key, { ...item, codes: item.companyCode === "—" ? [] : [item.companyCode] });
  }
  return [...groups.values()];
}

/**
 * Everything the overview cannot state as a number: unreachable instances, instances
 * with nothing entered, and companies computed on a fallback profile.
 *
 * A gap in the company table is explained here. Nothing is left silently blank.
 */
export function AttentionPanel({ attention }: { attention: GroupAttentionItem[] }) {
  const [severity, setSeverity] = useState("ALL");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);

  const counts = {
    CRITICAL: attention.filter((item) => item.severity === "CRITICAL").length,
    HIGH: attention.filter((item) => item.severity === "HIGH").length,
    MEDIUM: attention.filter((item) => item.severity === "MEDIUM").length,
  };

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return attention.filter((item) => {
      if (severity !== "ALL" && item.severity !== severity) return false;
      if (!needle) return true;
      return `${item.companyCode} ${item.title} ${item.detail}`.toLowerCase().includes(needle);
    });
  }, [attention, severity, q]);

  if (attention.length === 0) {
    return (
      <section className="rounded-2xl border border-border/50 bg-card px-4 py-6 shadow-sm">
        <p className="text-sm text-muted-foreground">Every company answered and has figures for this year.</p>
      </section>
    );
  }

  const total = filtered.length;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const start = (safePage - 1) * PAGE_SIZE;
  const visible = collapseCodes(filtered.slice(start, start + PAGE_SIZE));
  const dirty = severity !== "ALL" || q !== "";

  return (
    <section className="overflow-hidden rounded-2xl border border-border/50 border-t-[3px] border-t-primary/40 bg-card shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">Needs attention</h2>
          <p className="text-[11px] text-muted-foreground">
            Every gap the numbers above cannot show.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {counts.CRITICAL > 0 && (
            <Badge variant="outline" className={cn("tabular-nums", toneClass("danger"))}>{counts.CRITICAL} critical</Badge>
          )}
          {counts.HIGH > 0 && (
            <Badge variant="outline" className={cn("tabular-nums", toneClass("warning"))}>{counts.HIGH} high</Badge>
          )}
          {counts.MEDIUM > 0 && (
            <Badge variant="outline" className={cn("tabular-nums", toneClass("info"))}>{counts.MEDIUM} medium</Badge>
          )}
        </div>
      </div>

      <div aria-label="Attention filters" className="border-b border-border/50 px-4 py-3">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto]">
          <div className="relative">
            <Search
              aria-hidden
              className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              value={q}
              onChange={(event) => {
                setQ(event.target.value);
                setPage(1);
              }}
              placeholder="Company, title or detail…"
              aria-label="Search attention items"
              className="pl-8"
            />
          </div>

          <Select
            value={severity}
            onValueChange={(value) => {
              setSeverity(value);
              setPage(1);
            }}
          >
            <SelectTrigger aria-label="Severity" className="w-full">
              <SelectValue placeholder="Severity" />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              <SelectItem value="ALL">All severities</SelectItem>
              <SelectItem value="CRITICAL">Critical</SelectItem>
              <SelectItem value="HIGH">High</SelectItem>
              <SelectItem value="MEDIUM">Medium</SelectItem>
            </SelectContent>
          </Select>

          {dirty && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setQ("");
                setSeverity("ALL");
                setPage(1);
              }}
            >
              <X aria-hidden className="h-4 w-4" />
              Clear filters
            </Button>
          )}
        </div>
      </div>

      <ul className="divide-y">
        {visible.map((item) => (
          <li key={item.key} className="flex items-start gap-3 px-4 py-3">
            <Badge
              variant="outline"
              className={cn("mt-0.5 shrink-0 text-[10px] font-semibold uppercase", toneClass(SEVERITY_TONE[item.severity]))}
            >
              {item.severity}
            </Badge>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium" title={item.title}>
                {item.codes.length > 0 && (
                  <span className="mr-2 font-mono text-xs text-muted-foreground">{item.codes.join(", ")}</span>
                )}
                {item.title}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground [overflow-wrap:anywhere]">{item.detail}</p>
            </div>
          </li>
        ))}
        {total === 0 && (
          <li className="px-4 py-8 text-center text-sm text-muted-foreground">No item matches these filters.</li>
        )}
      </ul>

      {total > 0 && (
        <div className="border-t px-4 py-3">
          <TablePager
            page={safePage}
            pageCount={pageCount}
            total={total}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
          />
        </div>
      )}
    </section>
  );
}
