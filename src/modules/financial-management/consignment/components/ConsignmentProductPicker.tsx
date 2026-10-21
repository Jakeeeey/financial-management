"use client";

import { useEffect, useState } from "react";
import {
  searchConsignmentProducts,
  type ConsignmentProductOption,
} from "../providers/consignmentApi";

export default function ConsignmentProductPicker({
  value,
  onChange,
}: {
  value: ConsignmentProductOption | null;
  onChange: (value: ConsignmentProductOption | null) => void;
}) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<ConsignmentProductOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const query = search.trim();
    if (query.length < 2) return;
    let active = true;
    const timer = window.setTimeout(() => {
      if (!active) return;
      setLoading(true);
      void searchConsignmentProducts(query)
        .then((value) => { if (active) setResults(value); })
        .catch((cause: unknown) => {
          if (!active) return;
          setResults([]);
          setError(cause instanceof Error ? cause.message : "Could not search active products.");
        })
        .finally(() => { if (active) setLoading(false); });
    }, 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [search]);

  if (value) {
    return (
      <div className="flex min-w-48 items-center justify-between gap-2 rounded-md border bg-background px-3 py-2 text-sm">
        <span className="min-w-0 truncate"><span className="font-medium">{value.productCode || `#${value.productId}`}</span> · {value.productName}</span>
        <button type="button" className="shrink-0 text-xs text-primary underline" onClick={() => onChange(null)}>Change</button>
      </div>
    );
  }

  return (
    <div className="relative min-w-48">
      <input
        className="h-10 w-full rounded-md border bg-background px-3 text-sm"
        value={search}
        placeholder="Search active products"
        aria-label="Search active products"
        onChange={(event) => {
          const next = event.target.value;
          setSearch(next);
          setResults([]);
          setError("");
          if (next.trim().length < 2) {
            setLoading(false);
          } else {
            setLoading(true);
          }
        }}
      />
      {search.trim().length >= 2 && (
        <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-md border bg-popover p-1 shadow-md">
          {loading && <p className="px-2 py-2 text-sm text-muted-foreground">Searching…</p>}
          {error && <p className="px-2 py-2 text-sm text-destructive">{error}</p>}
          {!loading && !error && results.map((product) => (
            <button
              key={product.productId}
              type="button"
              className="block w-full rounded px-2 py-2 text-left text-sm hover:bg-accent"
              onClick={() => { onChange(product); setSearch(""); setResults([]); }}
            >
              <span className="font-medium">{product.productCode || `#${product.productId}`}</span>
              <span className="ml-2 text-muted-foreground">{product.productName}</span>
            </button>
          ))}
          {!loading && !error && results.length === 0 && <p className="px-2 py-2 text-sm text-muted-foreground">No active products found.</p>}
        </div>
      )}
    </div>
  );
}
