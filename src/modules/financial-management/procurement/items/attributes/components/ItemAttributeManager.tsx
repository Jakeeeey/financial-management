"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Plus } from "lucide-react";
import { useAttributes } from "../hooks/useItemAttributes";
import { AttributeCard } from "./AttributeCard";
import { AttributeCreateModal } from "./AttributeCreateModal";
export default function ItemAttributeManager() {
  const { attributes, loading, addAttribute, addAttributeValue } =
    useAttributes();
  const [showCreateModal, setShowCreateModal] = useState(false);

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
        <h2 className="text-2xl font-bold truncate">Attributes &amp; Values</h2>
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {attributes.map((attr) => (
            <AttributeCard
              key={attr.id}
              attribute={attr}
              values={attr.attribute_values || []}
              onAddValue={addAttributeValue}
            />
          ))}
        </div>
      )}

      <AttributeCreateModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        onSaved={addAttribute}
      />
    </div>
  );
}
