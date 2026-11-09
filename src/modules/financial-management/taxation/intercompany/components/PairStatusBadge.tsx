"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import { toneClass, type Tone } from "../constants";
import type { IntercompanyPair, PairStatus } from "../types";

const STATUS_TONE: Record<PairStatus, Tone> = {
  MATCHED: "success",
  DIFFERENT: "warning",
  MISSING: "neutral",
  NOT_LINKABLE: "info",
};

export function statusLabel(pair: IntercompanyPair): string {
  switch (pair.status) {
    case "MATCHED":
      return "Matched";
    case "DIFFERENT":
      return "Amount differs";
    case "MISSING":
      return pair.missingSide === "BUYER" ? "No purchase at buyer" : "No invoice at seller";
    case "NOT_LINKABLE":
      return "Not linkable";
  }
}

/** One pill for the pair's reciprocal status, shared by the matrix and its drilldown. */
export function PairStatusBadge({ pair }: { pair: IntercompanyPair }) {
  return (
    <Badge variant="outline" className={cn("text-[11px] font-medium", toneClass(STATUS_TONE[pair.status]))}>
      {statusLabel(pair)}
    </Badge>
  );
}
