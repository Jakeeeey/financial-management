"use client";

import type { Column } from "@tanstack/react-table";
import { ChevronDown, ChevronsUpDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

export function DataTableColumnHeader<TData, TValue>({
  column,
  label,
  className,
}: {
  column: Column<TData, TValue>;
  label: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2 py-1 text-left text-sm font-semibold hover:bg-accent",
        className,
      )}
    >
      {label}
      {column.getIsSorted() === "desc" ? (
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      ) : column.getIsSorted() === "asc" ? (
        <ChevronUp className="h-4 w-4 text-muted-foreground" />
      ) : (
        <ChevronsUpDown className="h-4 w-4 text-muted-foreground" />
      )}
    </button>
  );
}
