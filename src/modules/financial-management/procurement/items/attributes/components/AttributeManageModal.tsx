"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Pencil, Plus, Search } from "lucide-react";
import { isActiveFlag } from "../hooks/useItemAttributes";
import { formatDateTime } from "../../utils/utils";
import { AttributeValueModal, type ValueDraft } from "./AttributeValueModal";
import type {
  CreateAttributeValueInput,
  ItemAttribute,
  ItemAttributeValue,
  UpdateAttributeInput,
  UpdateAttributeValueInput,
} from "@/modules/financial-management/procurement/items/utils/types";

export type ManagedAttribute = ItemAttribute & {
  attribute_values: ItemAttributeValue[];
};

const VALUES_PAGE_SIZE = 10;

interface AttributeManageModalProps {
  attribute: ManagedAttribute | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdateAttribute: (id: number, data: UpdateAttributeInput) => Promise<void>;
  onToggleAttribute: (id: number, next: boolean) => Promise<void>;
  onAddValue: (data: CreateAttributeValueInput) => Promise<void>;
  onUpdateValue: (id: number, data: UpdateAttributeValueInput) => Promise<void>;
  onToggleValue: (id: number, next: boolean) => Promise<void>;
  onSaved: () => void | Promise<void>;
}

function fallback(value: unknown): string {
  if (value === null || value === undefined) return "—";
  const text = String(value).trim();
  return text.length > 0 ? text : "—";
}

export function AttributeManageModal({
  attribute,
  open,
  onOpenChange,
  onUpdateAttribute,
  onToggleAttribute,
  onAddValue,
  onUpdateValue,
  onToggleValue,
  onSaved,
}: AttributeManageModalProps) {
  const [nameDraft, setNameDraft] = useState("");
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const [savingHeader, setSavingHeader] = useState(false);
  const [togglingAttr, setTogglingAttr] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [valueModal, setValueModal] = useState<{
    mode: "add" | "edit";
    value: ItemAttributeValue | null;
  } | null>(null);
  const [savingValue, setSavingValue] = useState(false);
  const [togglingValueId, setTogglingValueId] = useState<number | null>(null);

  useEffect(() => {
    if (open && attribute) {
      setNameDraft(attribute.name);
      setDescriptionDraft(attribute.description ?? "");
      setSearch("");
      setPage(1);
      setValueModal(null);
    }
  }, [open, attribute]);

  const values = useMemo(
    () => attribute?.attribute_values ?? [],
    [attribute]
  );
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return values;
    return values.filter((v) => v.name.toLowerCase().includes(q));
  }, [values, search]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / VALUES_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = useMemo(
    () =>
      filtered.slice(
        (safePage - 1) * VALUES_PAGE_SIZE,
        safePage * VALUES_PAGE_SIZE
      ),
    [filtered, safePage]
  );

  if (!attribute) return null;
  const attr: ManagedAttribute = attribute;

  const headerDirty =
    nameDraft.trim() !== attr.name ||
    descriptionDraft.trim() !== (attr.description ?? "").trim();

  async function handleSaveHeader() {
    if (!nameDraft.trim() || !headerDirty) return;
    setSavingHeader(true);
    try {
      const payload: UpdateAttributeInput = { name: nameDraft.trim() };
      const desc = descriptionDraft.trim();
      if (desc !== (attribute?.description ?? "").trim()) {
        payload.description = desc.length > 0 ? desc : null;
      }
      await onUpdateAttribute(attr.id, payload);
      await onSaved();
    } catch {
    } finally {
      setSavingHeader(false);
    }
  }

  async function handleToggleAttribute(next: boolean) {
    setTogglingAttr(true);
    try {
      await onToggleAttribute(attr.id, next);
      await onSaved();
    } catch {
    } finally {
      setTogglingAttr(false);
    }
  }

  async function handleSubmitValue(draft: ValueDraft) {
    const editing = valueModal?.value ?? null;
    if (!draft.name.trim()) return;
    setSavingValue(true);
    try {
      if (editing) {
        const payload: UpdateAttributeValueInput = {};
        if (draft.name.trim() !== editing.name) {
          payload.name = draft.name.trim();
        }
        const desc = draft.description.trim();
        if (desc !== (editing.description ?? "").trim()) {
          payload.description = desc.length > 0 ? desc : null;
        }
        if (
          draft.extraPrice.trim() &&
          Number(draft.extraPrice) !== Number(editing.extra_price ?? 0)
        ) {
          payload.extra_price = Number(draft.extraPrice);
        }
        if (Object.keys(payload).length > 0) {
          await onUpdateValue(editing.id, payload);
          await onSaved();
        }
      } else {
        const payload: CreateAttributeValueInput = {
          attribute_id: attr.id,
          name: draft.name.trim(),
        };
        if (draft.description.trim()) {
          payload.description = draft.description.trim();
        }
        if (draft.extraPrice.trim()) {
          payload.extra_price = Number(draft.extraPrice);
        }
        await onAddValue(payload);
        await onSaved();
      }
      setValueModal(null);
    } catch {
    } finally {
      setSavingValue(false);
    }
  }

  async function handleToggleValue(v: ItemAttributeValue, next: boolean) {
    setTogglingValueId(v.id);
    try {
      await onToggleValue(v.id, next);
      await onSaved();
    } catch {
    } finally {
      setTogglingValueId(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle>Manage Attribute</DialogTitle>
        </DialogHeader>

        <div className="space-y-2 rounded-lg border p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="manage-attr-name">Attribute Name</Label>
              <Input
                id="manage-attr-name"
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                className="min-w-0"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="manage-attr-description">Description</Label>
              <Textarea
                id="manage-attr-description"
                value={descriptionDraft}
                onChange={(e) => setDescriptionDraft(e.target.value)}
                rows={2}
                className="min-w-0"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Created By</p>
              <p className="truncate" title={fallback(attr.created_by)}>
                {fallback(attr.created_by)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Created At</p>
              <p className="truncate" title={formatDateTime(attr.created_at)}>
                {formatDateTime(attr.created_at)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Updated By</p>
              <p className="truncate" title={fallback(attr.updated_by)}>
                {fallback(attr.updated_by)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Updated At</p>
              <p className="truncate" title={formatDateTime(attr.updated_at)}>
                {formatDateTime(attr.updated_at)}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-2">
              <Switch
                id="manage-attr-active"
                checked={isActiveFlag(attr.is_active)}
                disabled={togglingAttr}
                onCheckedChange={(next) => void handleToggleAttribute(next)}
              />
              <Label htmlFor="manage-attr-active">
                {isActiveFlag(attr.is_active) ? "Active" : "Inactive"}
              </Label>
              {togglingAttr && (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>
            <Button
              size="sm"
              disabled={savingHeader || !nameDraft.trim() || !headerDirty}
              onClick={() => void handleSaveHeader()}
            >
              {savingHeader && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Save Attribute
            </Button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search values..."
              className="pl-8 min-w-0"
            />
          </div>
          <Button
            type="button"
            size="sm"
            onClick={() => setValueModal({ mode: "add", value: null })}
            className="shrink-0"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Value
          </Button>
        </div>

        <div className="overflow-x-auto rounded-lg border">
          <Table className="min-w-[480px]">
            <TableHeader>
              <TableRow>
                <TableHead>Value Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Edit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={3}
                    className="text-center text-muted-foreground"
                  >
                    {values.length === 0
                      ? "No values yet — add the first value above."
                      : "No values match your search."}
                  </TableCell>
                </TableRow>
              ) : (
                paged.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell className="max-w-[220px] truncate font-medium">
                      {v.name}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={isActiveFlag(v.is_active)}
                          disabled={togglingValueId === v.id}
                          onCheckedChange={(next) =>
                            void handleToggleValue(v, next)
                          }
                          aria-label={`Toggle status for ${v.name}`}
                        />
                        {togglingValueId === v.id && (
                          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setValueModal({ mode: "edit", value: v })
                        }
                        aria-label={`Edit ${v.name}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          {filtered.length > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 py-2 text-xs text-muted-foreground border-t">
              <span>
                Showing {Math.min((safePage - 1) * VALUES_PAGE_SIZE + 1, filtered.length)}–{Math.min(safePage * VALUES_PAGE_SIZE, filtered.length)} of {filtered.length} record{filtered.length !== 1 ? "s" : ""} · Page {safePage} of {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}>
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage(safePage + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>

        <AttributeValueModal
          key={
            valueModal
              ? `${valueModal.mode}-${valueModal.value?.id ?? "new"}`
              : "closed"
          }
          open={valueModal !== null}
          onOpenChange={(next) => {
            if (!next) setValueModal(null);
          }}
          mode={valueModal?.mode ?? "add"}
          value={valueModal?.value ?? null}
          saving={savingValue}
          onSubmit={(draft) => void handleSubmitValue(draft)}
        />
      </DialogContent>
    </Dialog>
  );
}
