"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import {
  listAttributes,
  createAttribute,
  createAttributeValue,
} from "../providers/item-attribute-service";
import type { ItemAttribute, ItemAttributeValue } from "../utils/types";

export function useAttributes() {
  const [attributes, setAttributes] = useState<ItemAttribute[]>([]);
  const [loading, setLoading] = useState(true);
  const abortRef = useRef<AbortController | null>(null);

  const fetchAll = useCallback(async () => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    setLoading(true);
    try {
      const attrRes = await listAttributes();
      if (ac.signal.aborted) return;

      const attrs = ((attrRes.data || []) as unknown[]).map((a: unknown) => {
        const record = a as Record<string, unknown>;
        return {
          ...record,
          attribute_values: ((record.attribute_values || []) as unknown[]).map(
            (v: unknown) => {
              const val = v as Record<string, unknown>;
              return {
                ...val,
                attribute_id: Number(val.attribute_id),
                extra_price: Number(val.extra_price ?? 0),
              };
            }
          ),
        } as ItemAttribute;
      });
      setAttributes(attrs);
    } catch {
      if (ac.signal.aborted) return;
      toast.error("Failed to load attributes");
    } finally {
      if (!ac.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    return () => abortRef.current?.abort();
  }, [fetchAll]);

  const addAttribute = useCallback(
    async (data: { name: string; display_type: string }) => {
      try {
        const res = await createAttribute(data);
        setAttributes((prev) => [
          ...prev,
          { ...res.data, attribute_values: [] },
        ]);
        toast.success("Attribute created");
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to create attribute"
        );
        throw err;
      }
    },
    []
  );

  const addAttributeValue = useCallback(
    async (data: { attribute_id: number; name: string; extra_price?: number }) => {
      try {
        const res = await createAttributeValue(data);
        const newVal: ItemAttributeValue = {
          ...res.data,
          attribute_id: Number(res.data.attribute_id ?? data.attribute_id),
          extra_price: Number(res.data.extra_price ?? data.extra_price ?? 0),
        };
        setAttributes((prev) =>
          prev.map((a) =>
            a.id === newVal.attribute_id
              ? { ...a, attribute_values: [...(a.attribute_values || []), newVal] }
              : a
          )
        );
        toast.success("Value added");
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to add value"
        );
        throw err;
      }
    },
    []
  );

  return { attributes, loading, fetchAll, addAttribute, addAttributeValue };
}
