"use client";

import { useEffect, useState } from "react";
import { ConsigneeReadError, listConsignees } from "../providers/consignees.api";
import type { ConsigneePage, ConsigneeQuery, ConsignmentWorkspace } from "../types";

export function useConsignees(workspace: ConsignmentWorkspace = "consignees") {
  const [query, setStoredQuery] = useState<ConsigneeQuery>({ search: "", page: 1, pageSize: 25, status: workspace === "approvals" ? "PENDING" : "ALL" });
  const [revision, setRevision] = useState(0);
  const [snapshot, setSnapshot] = useState<{ data: ConsigneePage; query: ConsigneeQuery; key: string; updated: string } | null>(null);
  const [completed, setCompleted] = useState<{ key: string; error: ConsigneeReadError | null } | null>(null);
  const key = JSON.stringify([query.search, query.page, query.pageSize, query.status, workspace, revision]);
  const loading = completed?.key !== key;
  const error = completed?.key === key ? completed.error : null;

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    listConsignees(query, controller.signal, workspace).then(data => {
      if (active) {
        setSnapshot({ data, query, key, updated: new Date().toISOString() });
        setCompleted({ key, error: null });
      }
    }).catch(cause => {
      if (!active) return;
      const failure = cause instanceof ConsigneeReadError ? cause : new ConsigneeReadError("Unable to reach the server. Please retry.", 0);
      if (failure.status === 401 || failure.status === 403) setSnapshot(null);
      setCompleted({ key, error: failure });
    });
    return () => { active = false; controller.abort(); };
  }, [query, key, workspace]);

  return {
    query, snapshot, loading, error,
    setQuery: (next: ConsigneeQuery) => setStoredQuery(current => current.search === next.search
      && current.status === next.status && current.page === next.page && current.pageSize === next.pageSize ? current : next),
    pending: loading || (snapshot !== null && snapshot.key !== key && error === null),
    refresh: () => setRevision(value => value + 1),
  };
}
