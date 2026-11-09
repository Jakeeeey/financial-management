"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface InlineAlertProps {
  tone?: "error" | "warning" | "info";
  children: ReactNode;
  className?: string;
}

const TONES: Record<NonNullable<InlineAlertProps["tone"]>, string> = {
  error: "border-destructive/40 bg-destructive/5 text-destructive",
  warning: "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200",
  info: "border-border bg-muted/40 text-muted-foreground",
};

/** An inline message that keeps the form usable — never a blocking modal. */
export function InlineAlert({ tone = "error", children, className }: InlineAlertProps) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn("rounded-lg border px-3 py-2 text-sm", TONES[tone], className)}
    >
      {children}
    </div>
  );
}
