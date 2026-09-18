"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { formatDateTime } from "../../utils/utils";
import type { ItemAttributeValue } from "@/modules/financial-management/procurement/items/utils/types";

export interface ValueDraft {
  name: string;
  description: string;
  extraPrice: string;
}

interface AttributeValueModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "add" | "edit";
  value: ItemAttributeValue | null;
  saving: boolean;
  onSubmit: (draft: ValueDraft) => void;
}

function fallback(value: unknown): string {
  if (value === null || value === undefined) return "—";
  const text = String(value).trim();
  return text.length > 0 ? text : "—";
}

export function AttributeValueModal({
  open,
  onOpenChange,
  mode,
  value,
  saving,
  onSubmit,
}: AttributeValueModalProps) {
  // Initialized from props on mount. The parent remounts this dialog via
  // `key` on every open (mode/value change), so no reset effect is needed.
  const [name, setName] = useState(value?.name ?? "");
  const [description, setDescription] = useState(value?.description ?? "");
  // Extra Price is UI-hidden only (display tweak): keep the existing record's
  // value as the payload default so POST/PATCH shapes stay byte-identical.
  const extraPrice =
    value?.extra_price != null ? String(value.extra_price) : "";

  const isEdit = mode === "edit";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit({ name, description, extraPrice });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Value" : "Add Value"}</DialogTitle>
        </DialogHeader>

        {isEdit && value && (
          <div className="grid grid-cols-2 gap-3 rounded-lg border p-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Created By</p>
              <p className="truncate" title={fallback(value.created_by)}>
                {fallback(value.created_by)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Created At</p>
              <p className="truncate" title={formatDateTime(value.created_at)}>
                {formatDateTime(value.created_at)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Updated By</p>
              <p className="truncate" title={fallback(value.updated_by)}>
                {fallback(value.updated_by)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Updated At</p>
              <p className="truncate" title={formatDateTime(value.updated_at)}>
                {formatDateTime(value.updated_at)}
              </p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="attr-value-name">Value Name *</Label>
            <Input
              id="attr-value-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Red, Large, Cotton"
              required
              className="w-full min-w-0"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="attr-value-description">Description</Label>
            <Textarea
              id="attr-value-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              rows={3}
              className="w-full min-w-0"
            />
          </div>
          <DialogFooter className="gap-2 pt-2">
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={saving || !name.trim()}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
