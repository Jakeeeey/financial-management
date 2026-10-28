"use client";

import { useState, useCallback, useRef, useEffect } from "react";
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
  reportGeneratedAt: string | null;
  canAnalyze: boolean;
}

export function useCashFlowAI({
  entries,
  summary,
  startDate,
  endDate,
  reportGeneratedAt,
  canAnalyze,
}: UseCashFlowAIOptions) {
  const [insightState, setInsightState] = useState<{
    snapshotKey: string;
    insight: AIInsight;
  } | null>(null);
  const [analyzingSnapshotKey, setAnalyzingSnapshotKey] = useState<string | null>(null);
  const [errorState, setErrorState] = useState<{
    snapshotKey: string;
    message: string;
  } | null>(null);

  const snapshotKey = `${reportGeneratedAt ?? "unloaded"}|${startDate}|${endDate}`;
  const insight = insightState?.snapshotKey === snapshotKey ? insightState.insight : null;
  const isAnalyzing = analyzingSnapshotKey === snapshotKey;
  const error = errorState?.snapshotKey === snapshotKey ? errorState.message : null;
  const hasRun = insight !== null;
  const latestSnapshotKeyRef = useRef(snapshotKey);
  const previousSnapshotKeyRef = useRef(snapshotKey);
  const requestControllerRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);
  latestSnapshotKeyRef.current = snapshotKey;

  useEffect(() => {
    if (previousSnapshotKeyRef.current === snapshotKey) return;

    previousSnapshotKeyRef.current = snapshotKey;
    requestIdRef.current += 1;
    requestControllerRef.current?.abort();
    requestControllerRef.current = null;
    setInsightState(null);
    setErrorState(null);
    setAnalyzingSnapshotKey(null);
  }, [snapshotKey]);

  useEffect(() => () => requestControllerRef.current?.abort(), []);

  const analyze = useCallback(async () => {
    if (!canAnalyze) return;
    if (entries.length === 0) {
      toast.error("No cash flow data to analyze");
      return;
    }

    requestControllerRef.current?.abort();
    const controller = new AbortController();
    requestControllerRef.current = controller;
    const requestId = ++requestIdRef.current;
    const requestedSnapshotKey = snapshotKey;
    setAnalyzingSnapshotKey(requestedSnapshotKey);
    setErrorState(null);

    try {
      const result = await analyzeCashFlowWithAI({
        entries,
        summary,
        period: { startDate, endDate },
      }, controller.signal);

      if (
        controller.signal.aborted ||
        requestId !== requestIdRef.current ||
        latestSnapshotKeyRef.current !== requestedSnapshotKey
      ) return;
      setInsightState({ snapshotKey: requestedSnapshotKey, insight: result });
      toast.success("Cash flow analysis complete");
    } catch (err) {
      if (
        controller.signal.aborted ||
        requestId !== requestIdRef.current ||
        latestSnapshotKeyRef.current !== requestedSnapshotKey
      ) return;
      const errorMessage =
        err instanceof Error ? err.message : "Failed to analyze cash flow data";
      setErrorState({ snapshotKey: requestedSnapshotKey, message: errorMessage });
      toast.error(errorMessage);
    } finally {
      if (requestId === requestIdRef.current) {
        requestControllerRef.current = null;
        setAnalyzingSnapshotKey(null);
      }
    }
  }, [canAnalyze, entries, endDate, snapshotKey, startDate, summary]);

  const reset = useCallback(() => {
    requestIdRef.current += 1;
    requestControllerRef.current?.abort();
    requestControllerRef.current = null;
    setInsightState(null);
    setErrorState(null);
    setAnalyzingSnapshotKey(null);
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
