"use client";

import { useEffect, useState } from "react";
import { AgreementApiError, listAgreements } from "../providers/agreements.api";
import type { AgreementPage, AgreementQuery } from "../agreement-types";

export function useAgreements() {
  const [query, setQuery] = useState<AgreementQuery>({ search: "", status: "ALL", page: 1, pageSize: 25 });
  const [revision, setRevision] = useState(0);
  const [snapshot, setSnapshot] = useState<{ data: AgreementPage; query: AgreementQuery; updated: string; key: string } | null>(null);
  const [completed, setCompleted] = useState<{ key: string; error: AgreementApiError | null } | null>(null);
  const key = JSON.stringify([query, revision]);
  const loading = completed?.key !== key;
  const error = completed?.key === key ? completed.error : null;
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    listAgreements(query, controller.signal).then(data => {
      if (active) { setSnapshot({ data, query, key, updated: new Date().toISOString() }); setCompleted({ key, error: null }); }
    }).catch(error => {
      if (!active) return;
      const failure = error instanceof AgreementApiError ? error : new AgreementApiError("Unable to load agreements. Retry loading.", 0);
      if (failure.status === 401 || failure.status === 403) setSnapshot(null);
      setCompleted({ key, error: failure });
    });
    return () => { active = false; controller.abort(); };
  }, [query, key]);
  return { query, setQuery, snapshot, loading, error, refresh: () => setRevision(value => value + 1) };
}
