"use client";

import * as React from "react";
import { toast } from "sonner";

import type { DeliveryTermRow, DeliveryTermPayload } from "../types";
import * as api from "../providers/fetchProvider";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";

type Mode = "create" | "edit";

function toStr(v: unknown) {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

export default function DeliveryTermsFormDialog(props: {
  open: boolean;
  onOpenChange: (v: boolean) => void;

  mode: Mode;
  row?: DeliveryTermRow | null;

  onCreate: (payload: DeliveryTermPayload) => Promise<void> | void;

  onUpdate: (id: number, payload: Partial<DeliveryTermPayload>) => Promise<void> | void;
}) {
  const { open, onOpenChange, mode, row, onCreate, onUpdate } = props;

  const [deliveryName, setDeliveryName] = React.useState("");
  const [deliveryDescription, setDeliveryDescription] = React.useState("");
  const [isCheckingName, setIsCheckingName] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;

    if (mode === "edit" && row) {
      setDeliveryName(toStr(row.delivery_name));
      setDeliveryDescription(toStr(row.delivery_description));
    } else {
      setDeliveryName("");
      setDeliveryDescription("");
    }
  }, [open, mode, row]);

  function validate() {
    if (!deliveryName.trim()) return "Delivery Name is required";
    return null;
  }

  async function submit() {
    const msg = validate();
    if (msg) {
      toast.error(msg);
      return;
    }

    setIsCheckingName(true);

    try {
      // Check if name already exists before submitting
      const exists = await api.checkDeliveryNameExists(
        deliveryName.trim(),
        mode === "edit" ? row?.id : undefined
      );
      
      if (exists) {
        toast.error("Delivery name is already taken");
        return;
      }

      setIsSubmitting(true);

      const userId = await api.getCurrentUserId();
      console.log("🔑 getCurrentUserId result:", userId, "typeof:", typeof userId);

      // Build payload step by step
      const payload: DeliveryTermPayload = {
        delivery_name: deliveryName.trim(),
      };

      // Only add description if it's not empty
      if (deliveryDescription.trim()) {
        payload.delivery_description = deliveryDescription.trim();
      }

      // Add user tracking
      if (userId) {
        if (mode === "create") {
          payload.created_by = userId;
          console.log("✅ Added created_by:", userId, "to payload");
        } else if (mode === "edit") {
          payload.updated_by = userId;
          console.log("✅ Added updated_by:", userId, "to payload");
        }
      } else {
        console.warn("⚠️  userId is", userId, "not adding user tracking");
      }

      console.log("📦 Final payload being sent:", payload);

      if (mode === "create") {
        await onCreate(payload);
      } else if (mode === "edit" && row?.id) {
        await onUpdate(row.id, payload);
      }
    } finally {
      setIsCheckingName(false);
      setIsSubmitting(false);
    }
  }

  const title = mode === "create" ? "Add Delivery Term" : "Edit Delivery Term";
  const primaryText = mode === "create" ? "Create" : "Save Changes";

  // Prevent dialog from closing while checking or submitting
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && (isCheckingName || isSubmitting)) {
      return;  // Prevent closing
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg overflow-hidden">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 overflow-hidden">
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Delivery Name <span className="text-destructive">*</span>
            </label>
            <Input
              value={deliveryName}
              onChange={(e) => setDeliveryName(e.target.value)}
              placeholder="Enter delivery name..."
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2 w-full">
            <label className="text-sm font-medium">Description</label>
            <Textarea
              value={deliveryDescription}
              onChange={(e) => setDeliveryDescription(e.target.value)}
              placeholder="Enter description (optional)..."
              disabled={isSubmitting}
              className="min-h-[100px] max-h-[300px] w-full resize-none overflow-hidden overflow-y-auto break-words whitespace-pre-wrap"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="outline"
              className="cursor-pointer"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button 
              className="cursor-pointer" 
              onClick={submit} 
              disabled={isCheckingName || isSubmitting}
            >
              {isCheckingName || isSubmitting ? (
                <div className="flex items-center gap-2">
                  <Spinner className="h-4 w-4" />
                  {isCheckingName ? "Verifying..." : `${primaryText}...`}
                </div>
              ) : (
                primaryText
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
