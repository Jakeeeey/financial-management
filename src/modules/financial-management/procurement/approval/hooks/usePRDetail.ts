"use client";

import * as React from "react";
import type { ProcurementRequest, ProcurementDetail } from "../utils/types";
import { fetchPRById } from "../providers/approvalService";

type State = {
  master: ProcurementRequest | null;
  details: ProcurementDetail[];
  loading: boolean;
  error: string | null;
};

export function usePRDetail(id: number | null) {
  const [state, setState] = React.useState<State>({ master: null, details: [], loading: true, error: null });

  const runFetch = React.useCallback(async () => {
    if (id == null) {
      setState({ master: null, details: [], loading: false, error: null });
      return;
    }
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const res = await fetchPRById(id);
      setState({ master: res.master, details: res.details, loading: false, error: null });
    } catch (e: unknown) {
      setState((s) => ({ ...s, loading: false, error: e instanceof Error ? e.message : "Unknown error" }));
    }
  }, [id]);

  React.useEffect(() => { void runFetch(); }, [runFetch]);

  return { ...state, reload: runFetch };
}
