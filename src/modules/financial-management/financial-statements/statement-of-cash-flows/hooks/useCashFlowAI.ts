"use client";

import { useState, useCallback, useRef } from "react";
import { toast } from "sonner";
import {
  AIInsight,
  analyzeCashFlowWithAI,
} from "../services/ai-cash-flow.service";
import { CashFlowEntry } from "../types/cash-flow.schema";

interface UseCashFlowAIOptions {
  entries: CashFlowEntry[];
  summary: {
    operatingActivities: number;
    investingActivities: number;
    financingActivities: number;
    netIncreaseInCash: number;
  };
  startDate: string;
  endDate: string;
}

export function useCashFlowAI({
  entries,
  summary,
  startDate,
  endDate,
}: UseCashFlowAIOptions) {
  const [insight, setInsight] = useState<AIInsight | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasRun, setHasRun] = useState(false);

  // Use refs to avoid recreating the analyze callback on every data change
  const entriesRef = useRef(entries);
  const summaryRef = useRef(summary);
  const startDateRef = useRef(startDate);
  const endDateRef = useRef(endDate);

  entriesRef.current = entries;
  summaryRef.current = summary;
  startDateRef.current = startDate;
  endDateRef.current = endDate;

  const analyze = useCallback(async () => {
    const currentEntries = entriesRef.current;
    if (currentEntries.length === 0) {
      toast.error("No cash flow data to analyze");
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      const result = await analyzeCashFlowWithAI({
        entries: currentEntries,
        summary: summaryRef.current,
        period: {
          startDate: startDateRef.current,
          endDate: endDateRef.current,
        },
      });

      setInsight(result);
      setHasRun(true);
      toast.success("AI analysis complete");
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to analyze cash flow data";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsAnalyzing(false);
    }
  }, []); // Stable reference — never recreates

  const reset = useCallback(() => {
    setInsight(null);
    setError(null);
    setHasRun(false);
  }, []);

  return {
    insight,
    isAnalyzing,
    error,
    hasRun,
    analyze,
    reset,
  };
}