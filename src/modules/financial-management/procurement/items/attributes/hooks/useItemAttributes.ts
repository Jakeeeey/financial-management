"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import {
  listAttributes,
  createAttribute,
  createAttributeValue,
  updateAttribute as updateAttributeRequest,
  deleteAttribute as deleteAttributeRequest,
  updateAttributeValue as updateAttributeValueRequest,
  deleteAttributeValue as deleteAttributeValueRequest,
} from "../providers/item-attribute-service";
import type {
  CreateAttributeInput,
  CreateAttributeValueInput,
  ItemAttribute,
  ItemAttributeValue,
  UpdateAttributeInput,
  UpdateAttributeValueInput,
} from "@/modules/financial-management/procurement/items/utils/types";

export function isActiveFlag(v: unknown): boolean {
  return v == null ? true : v === true || v === 1 || v === "1";
}

export function useAttributes() {
  const [attributes, setAttributes] = useState<Array<ItemAttribute & { attribute_values: ItemAttributeValue[] }>>([]);
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
        } as ItemAttribute & { attribute_values: ItemAttributeValue[] };
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
    async (data: CreateAttributeInput) => {
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
    async (data: CreateAttributeValueInput) => {
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

  const updateAttribute = useCallback(
    async (id: number, data: UpdateAttributeInput) => {
      try {
        const res = await updateAttributeRequest(id, data);
        setAttributes((prev) =>
          prev.map((a) => (a.id === id ? { ...a, ...res.data } : a))
        );
        toast.success("Attribute updated");
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to update attribute"
        );
        throw err;
      }
    },
    []
  );

  const toggleAttribute = useCallback(
    async (id: number, next: boolean) => {
      try {
        const res = await updateAttributeRequest(id, { is_active: next });
        setAttributes((prev) =>
          prev.map((a) =>
            a.id === id
              ? { ...a, ...res.data, is_active: res.data.is_active ?? (next ? 1 : 0) }
              : a
          )
        );
        toast.success(next ? "Attribute activated" : "Attribute deactivated");
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to update attribute status"
        );
        throw err;
      }
    },
    []
  );

  const deleteAttribute = useCallback(
    async (id: number) => {
      try {
        await deleteAttributeRequest(id);
        setAttributes((prev) => prev.filter((a) => a.id !== id));
        toast.success("Attribute deleted");
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to delete attribute"
        );
        throw err;
      }
    },
    []
  );

  const toggleAttributeValue = useCallback(
    async (id: number, next: boolean) => {
      try {
        const res = await updateAttributeValueRequest(id, { is_active: next });
        setAttributes((prev) =>
          prev.map((a) => ({
            ...a,
            attribute_values: (a.attribute_values || []).map((v) =>
              v.id === id
                ? {
                    ...v,
                    ...res.data,
                    attribute_id: Number(
                      res.data.attribute_id ?? v.attribute_id
                    ),
                    is_active: res.data.is_active ?? (next ? 1 : 0),
                  }
                : v
            ),
          }))
        );
        toast.success(next ? "Value activated" : "Value deactivated");
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to update value status"
        );
        throw err;
      }
    },
    []
  );

  const updateAttributeValue = useCallback(
    async (id: number, data: UpdateAttributeValueInput) => {
      try {
        const res = await updateAttributeValueRequest(id, data);
        setAttributes((prev) =>
          prev.map((a) => ({
            ...a,
            attribute_values: (a.attribute_values || []).map((v) =>
              v.id === id
                ? {
                    ...v,
                    ...res.data,
                    attribute_id: Number(
                      res.data.attribute_id ?? v.attribute_id
                    ),
                  }
                : v
            ),
          }))
        );
        toast.success("Value updated");
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to update value"
        );
        throw err;
      }
    },
    []
  );

  const deleteAttributeValue = useCallback(
    async (id: number) => {
      try {
        await deleteAttributeValueRequest(id);
        setAttributes((prev) =>
          prev.map((a) => ({
            ...a,
            attribute_values: (a.attribute_values || []).filter(
              (v) => v.id !== id
            ),
          }))
        );
        toast.success("Value deleted");
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to delete value"
        );
        throw err;
      }
    },
    []
  );

  return {
    attributes,
    loading,
    fetchAll,
    addAttribute,
    addAttributeValue,
    updateAttribute,
    toggleAttribute,
    deleteAttribute,
    updateAttributeValue,
    toggleAttributeValue,
    deleteAttributeValue,
  };
}
