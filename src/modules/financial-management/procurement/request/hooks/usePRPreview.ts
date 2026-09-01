"use client";

import * as React from "react";
import type { ProcurementRequestPreview, ProcurementDetailPreview } from "../utils/types";
import { fetchPRPreview } from "../providers/requestService";

type State = {
  master: ProcurementRequestPreview | null;
  details: ProcurementDetailPreview[];
  loading: boolean;
  error: string | null;
};

export function usePRPreview(id: number) {
  const [state, setState] = React.useState<State>({ master: null, details: [], loading: true, error: null });

  const runFetch = React.useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const res = await fetchPRPreview(id);
      setState({ master: res.master, details: res.details, loading: false, error: null });
    } catch (e: unknown) {
      setState((s) => ({ ...s, loading: false, error: e instanceof Error ? e.message : "Unknown error" }));
    }
  }, [id]);

  React.useEffect(() => { void runFetch(); }, [runFetch]);

  return { ...state, reload: runFetch };
}