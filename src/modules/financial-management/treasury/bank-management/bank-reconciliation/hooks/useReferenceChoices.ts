"use client";

import { useEffect, useState } from "react";
import { searchBankReconciliationReferences } from "../providers/bankReconciliationReferencesApi";
import type { BankReconciliationReferenceQuery, BankReconciliationReferenceResource, BankReconciliationReferences } from "../reference-types";

export function useReferenceChoices<K extends BankReconciliationReferenceResource>(resource: K, { companyId, bankName, branch }: Pick<BankReconciliationReferenceQuery, "companyId" | "bankName" | "branch"> = {}) {
  const [open, setOpen] = useState(false), [search, setSearch] = useState("");
  const scope = JSON.stringify([resource, companyId, bankName, branch]);
  const [position, setPosition] = useState({ scope, page: 1 });
  const page = position.scope === scope ? position.page : 1;
  const key = JSON.stringify([scope, search, page]);
  const [result, setResult] = useState<{ key: string; items: BankReconciliationReferences[K][]; total: number; error: string } | null>(null);
  const current = result?.key === key ? result : null;
  const loading = open && !current;
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      searchBankReconciliationReferences(resource, { search, page, pageSize: 25, companyId, bankName, branch }, controller.signal)
        .then(data => { if (!controller.signal.aborted) setResult({ key, items: data.items, total: data.total, error: "" }); })
        .catch(e => { if (!controller.signal.aborted) setResult({ key, items: [], total: 0, error: e.message }); });
    }, 200);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [open, resource, search, page, companyId, bankName, branch, key]);
  function onOpenChange(value: boolean) {
    setOpen(value);
    if (value) { setSearch(""); setPosition({ scope, page: 1 }); setResult(null); }
  }
  function onSearchChange(value: string) { setSearch(value); setPosition({ scope, page: 1 }); }
  return { open, onOpenChange, search, onSearchChange, page, loading, items: current?.items || [], total: current?.total || 0, error: current?.error || "", previous: () => setPosition({ scope, page: page - 1 }), next: () => setPosition({ scope, page: page + 1 }) };
}
