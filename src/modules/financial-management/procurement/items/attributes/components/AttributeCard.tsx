"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Pencil, X } from "lucide-react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { ItemAttribute, ItemAttributeValue } from "@/modules/financial-management/procurement/items/utils/types";

interface AttributeCardProps {
  attribute: ItemAttribute;
  values: ItemAttributeValue[];
  onAddValue: (data: {
    attribute_id: number;
    name: string;
  }) => Promise<void>;
  onUpdateAttribute: (id: number, data: { name: string }) => Promise<void>;
  onDeleteAttribute: (id: number) => Promise<void>;
  onUpdateValue: (id: number, data: { name: string }) => Promise<void>;
  onDeleteValue: (id: number) => Promise<void>;
  onSaved: () => void | Promise<void>;
}

export function AttributeCard({
  attribute,
  values,
  onAddValue,
  onUpdateAttribute,
  onDeleteAttribute,
  onUpdateValue,
  onDeleteValue,
  onSaved,
}: AttributeCardProps) {
  const [valueName, setValueName] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(attribute.name);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editingValueId, setEditingValueId] = useState<number | null>(null);
  const [valueDraft, setValueDraft] = useState("");

  async function handleAddValue(e: React.FormEvent) {
    e.preventDefault();
    if (!valueName.trim()) return;
    setAdding(true);
    try {
      await onAddValue({
        attribute_id: attribute.id,
        name: valueName.trim(),
      });
      setValueName("");
    } catch {
    } finally {
      setAdding(false);
    }
  }

  async function handleSaveName() {
    const trimmed = nameDraft.trim();
    if (!trimmed || trimmed === attribute.name) {
      setEditingName(false);
      return;
    }
    try {
      await onUpdateAttribute(attribute.id, { name: trimmed });
      setEditingName(false);
      await onSaved();
    } catch {
      // keep the input open so the user can retry
    }
  }

  async function handleDeleteAttribute() {
    setDeleting(true);
    try {
      await onDeleteAttribute(attribute.id);
      setConfirmDeleteOpen(false);
      await onSaved();
    } catch {
      // toast already shown by the hook
    } finally {
      setDeleting(false);
    }
  }

  async function handleSaveValue(v: ItemAttributeValue) {
    const trimmed = valueDraft.trim();
    if (!trimmed || trimmed === v.name) {
      setEditingValueId(null);
      return;
    }
    try {
      await onUpdateValue(v.id, { name: trimmed });
      setEditingValueId(null);
      await onSaved();
    } catch {
      // keep the input open so the user can retry
    }
  }

  async function handleDeleteValue(v: ItemAttributeValue) {
    try {
      await onDeleteValue(v.id);
      await onSaved();
    } catch {
      // toast already shown by the hook
    }
  }

  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        {editingName ? (
          <Input
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={() => setEditingName(false)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void handleSaveName();
              } else if (e.key === "Escape") {
                setEditingName(false);
                setNameDraft(attribute.name);
              }
            }}
            className="h-7 text-sm font-semibold min-w-0"
            autoFocus
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              setNameDraft(attribute.name);
              setEditingName(true);
            }}
            className="group flex min-w-0 items-center gap-1.5 rounded px-1 py-0.5 text-left font-semibold hover:bg-muted/50"
            title="Click to rename"
          >
            <span className="truncate">{attribute.name}</span>
            <Pencil className="h-3 w-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
          </button>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 shrink-0 p-0"
          onClick={() => setConfirmDeleteOpen(true)}
          disabled={deleting}
          title="Delete attribute"
        >
          {deleting ? (
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : (
            <X className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-medium text-muted-foreground">
          Values
        </Label>
        {values.length === 0 ? (
          <p className="text-sm italic text-muted-foreground">No values yet</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {values.map((v) =>
              editingValueId === v.id ? (
                <Input
                  key={v.id}
                  value={valueDraft}
                  onChange={(e) => setValueDraft(e.target.value)}
                  onBlur={() => setEditingValueId(null)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void handleSaveValue(v);
                    } else if (e.key === "Escape") {
                      setEditingValueId(null);
                      setValueDraft(v.name);
                    }
                  }}
                  className="h-6 w-32 text-xs"
                  autoFocus
                />
              ) : (
                <span
                  key={v.id}
                  onClick={() => {
                    setValueDraft(v.name);
                    setEditingValueId(v.id);
                  }}
                  className="group/badge inline-flex max-w-[200px] cursor-pointer items-center gap-1 rounded-full border bg-muted/30 py-1 pl-3 pr-1 text-xs font-medium hover:bg-muted/50"
                  title="Click to rename"
                >
                  <span className="truncate">{v.name}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleDeleteValue(v);
                    }}
                    className="rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                    title="Delete value"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )
            )}
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

      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete attribute?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &quot;{attribute.name}&quot; and all
              of its values.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">
              Cancel
            </AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={() => void handleDeleteAttribute()}
              disabled={deleting}
            >
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}