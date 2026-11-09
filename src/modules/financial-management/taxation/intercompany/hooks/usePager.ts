"use client";

import { useMemo, useState } from "react";

/** Client-side paging for a table that already holds the whole year in memory. */
export function usePager<T>(rows: T[], pageSize = 10) {
  const [page, setPage] = useState(1);

  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const pageRows = useMemo(
    () => rows.slice((safePage - 1) * pageSize, safePage * pageSize),
    [rows, safePage, pageSize],
  );

  return { page: safePage, pageCount, pageRows, setPage };
}
