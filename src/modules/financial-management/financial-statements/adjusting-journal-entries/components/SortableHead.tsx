"use client";

import * as React from "react";
import { ArrowDownUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils";

import type { SortDirection, SortKey } from "./types";

type SortableHeadProps = {
  column: SortKey;
  activeColumn: SortKey;
  direction: SortDirection;
  className?: string;
  children: React.ReactNode;
  onSort: (column: SortKey) => void;
};

export function SortableHead({
  column,
  activeColumn,
  direction,
  className,
  children,
  onSort,
}: SortableHeadProps) {
  const isActive = activeColumn === column;
  return (
    <TableHead className={className}>
      <Button
        type="button"
        variant="ghost"
        className="-ml-2 h-8 w-full justify-start overflow-hidden px-1 text-[11px] font-medium xl:text-xs"
        onClick={() => onSort(column)}
      >
        <span className="truncate">{children}</span>
        <ArrowDownUp className={cn("ml-1 size-3", isActive ? "opacity-100" : "opacity-35")} />
        {isActive && <span className="sr-only">sorted {direction}</span>}
      </Button>
    </TableHead>
  );
}
