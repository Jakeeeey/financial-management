"use client";

import { useEffect, useState } from "react";
import { consignmentApi, type ConsignmentAccess } from "../providers/consignmentApi";

export function useConsignmentAccess() {
  const [access, setAccess] = useState<ConsignmentAccess | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void consignmentApi.getAccess()
      .then((result) => { if (active) setAccess(result); })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "Could not verify Consignment access.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  return { access, loading, error };
}
