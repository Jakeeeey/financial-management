"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";
import type { ItemAttribute, ItemAttributeValue } from "../utils/types";

interface AttributeCardProps {
  attribute: ItemAttribute;
  values: ItemAttributeValue[];
  onAddValue: (data: {
    attribute_id: number;
    name: string;
    extra_price?: number;
  }) => Promise<void>;
}

export function AttributeCard({
  attribute,
  values,
  onAddValue,
}: AttributeCardProps) {
  const [valueName, setValueName] = useState("");
  const [extraPrice, setExtraPrice] = useState("");
  const [adding, setAdding] = useState(false);

  async function handleAddValue(e: React.FormEvent) {
    e.preventDefault();
    if (!valueName.trim()) return;
    setAdding(true);
    try {
      await onAddValue({
        attribute_id: attribute.id,
        name: valueName.trim(),
        extra_price: extraPrice ? Number(extraPrice) : 0,
      });
      setValueName("");
      setExtraPrice("");
    } catch {
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="min-w-0 overflow-hidden">
          <h3 className="font-semibold truncate">{attribute.name}</h3>
          <p className="text-xs text-muted-foreground">
            Type: {attribute.display_type}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-medium text-muted-foreground">
          Values
        </Label>
        {values.length === 0 ? (
          <p className="text-sm italic text-muted-foreground">No values yet</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {values.map((v) => (
              <span
                key={v.id}
                className="inline-flex items-center gap-1 rounded-full border bg-muted/30 px-3 py-1 text-xs font-medium truncate max-w-[200px]"
              >
                <span className="truncate">{v.name}</span>
                {v.extra_price > 0 && (
                  <span className="text-muted-foreground shrink-0">
                    (+{v.extra_price})
                  </span>
                )}
              </span>
            ))}
          </div>
        )}
      </div>

      <form onSubmit={handleAddValue} className="flex flex-col sm:flex-row gap-2 pt-1">
        <div className="flex-1 min-w-0">
          <Input
            placeholder="New value"
            value={valueName}
            onChange={(e) => setValueName(e.target.value)}
            className="w-full h-8 text-sm truncate min-w-0 overflow-hidden"
          />
        </div>
        <div className="w-full sm:w-24 shrink-0">
          <Input
            type="number"
            step="0.01"
            min="0"
            placeholder="Price"
            value={extraPrice}
            onChange={(e) => setExtraPrice(e.target.value)}
            className="w-full h-8 text-sm min-w-0 overflow-hidden"
          />
        </div>
        <Button
          type="submit"
          size="sm"
          disabled={adding || !valueName.trim()}
          className="shrink-0 h-8"
        >
          {adding ? (
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : (
            <Plus className="h-3.5 w-3.5" />
          )}
          <span className="sr-only sm:not-sr-only sm:ml-1">Add</span>
        </Button>
      </form>
    </div>
  );
}
