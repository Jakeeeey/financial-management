"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Plus, Settings2 } from "lucide-react";
import { isActiveFlag, useAttributes } from "../hooks/useItemAttributes";
import { formatDateTime } from "../../utils/utils";
import { AttributeCreateModal } from "./AttributeCreateModal";
import {
  AttributeManageModal,
  type ManagedAttribute,
} from "./AttributeManageModal";

function fallback(value: unknown): string {
  if (value === null || value === undefined) return "—";
  const text = String(value).trim();
  return text.length > 0 ? text : "—";
}

export function activeValueCount(attr: ManagedAttribute): number {
  return (attr.attribute_values || []).filter((v) =>
    isActiveFlag(v.is_active)
  ).length;
}

export default function ItemAttributeManager() {
  const {
    attributes,
    loading,
    fetchAll,
    addAttribute,
    addAttributeValue,
    updateAttribute,
    toggleAttribute,
    updateAttributeValue,
    toggleAttributeValue,
  } = useAttributes();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [managed, setManaged] = useState<ManagedAttribute | null>(null);

  const liveManaged = managed
    ? (attributes.find((a) => a.id === managed.id) ?? managed)
    : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h2 className="text-2xl font-bold truncate max-w-[400px]">Attributes &amp; Values</h2>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Attribute
        </Button>
      </div>

      {attributes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <p className="text-lg font-medium">No attributes found</p>
          <p className="text-sm">Create your first attribute to get started.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table className="min-w-[1100px]">
            <TableHeader>
              <TableRow>
                <TableHead>Attribute Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Value Count</TableHead>
                <TableHead className="w-[150px] whitespace-nowrap">Created At</TableHead>
                <TableHead className="w-[110px] whitespace-nowrap">Created By</TableHead>
                <TableHead className="w-[150px] whitespace-nowrap">Updated At</TableHead>
                <TableHead className="w-[110px] whitespace-nowrap">Updated By</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {attributes.map((attr) => (
                <TableRow key={attr.id}>
                  <TableCell className="max-w-[220px] truncate font-medium">
                    {attr.name}
                  </TableCell>
                  <TableCell className="max-w-[280px] truncate">
                    {fallback(attr.description)}
                  </TableCell>
                  <TableCell>{activeValueCount(attr)}</TableCell>
                  <TableCell className="text-muted-foreground text-xs whitespace-nowrap tabular-nums" title={formatDateTime(attr.created_at)}>
                    {formatDateTime(attr.created_at)}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs whitespace-nowrap truncate max-w-[110px]" title={fallback(attr.created_by)}>
                    {fallback(attr.created_by)}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs whitespace-nowrap tabular-nums" title={formatDateTime(attr.updated_at)}>
                    {formatDateTime(attr.updated_at)}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs whitespace-nowrap truncate max-w-[110px]" title={fallback(attr.updated_by)}>
                    {fallback(attr.updated_by)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setManaged(attr)}
                    >
                      <Settings2 className="mr-2 h-4 w-4" />
                      Manage
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 py-2 text-xs text-muted-foreground border-t">
            <span>
              Showing {attributes.length} of {attributes.length} record
              {attributes.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
      )}

      <AttributeCreateModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        onSaved={addAttribute}
      />

      <AttributeManageModal
        attribute={liveManaged}
        open={liveManaged !== null}
        onOpenChange={(next) => {
          if (!next) setManaged(null);
        }}
        onUpdateAttribute={updateAttribute}
        onToggleAttribute={toggleAttribute}
        onAddValue={addAttributeValue}
        onUpdateValue={updateAttributeValue}
        onToggleValue={toggleAttributeValue}
        onSaved={fetchAll}
      />
    </div>
  );
}
