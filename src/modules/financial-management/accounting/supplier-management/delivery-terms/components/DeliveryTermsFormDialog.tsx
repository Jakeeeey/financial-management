"use client";

import * as React from "react";
import { toast } from "sonner";

import type { DeliveryTermRow, DeliveryTermPayload } from "../types";
import * as api from "../providers/fetchProvider";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

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
  const [nameError, setNameError] = React.useState("");
  const [isCheckingName, setIsCheckingName] = React.useState(false);

  // Check for duplicate name
  React.useEffect(() => {
    const timer = setTimeout(async () => {
      if (!deliveryName.trim() || mode === "edit") {
        setNameError("");
        return;
      }

      try {
        setIsCheckingName(true);
        const exists = await api.checkDeliveryNameExists(deliveryName.trim());
        if (exists) {
          setNameError("Delivery name is already taken");
        } else {
          setNameError("");
        }
      } catch{
        setNameError("");
      } finally {
        setIsCheckingName(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [deliveryName, mode]);

  React.useEffect(() => {
    if (!open) return;

    if (mode === "edit" && row) {
      setDeliveryName(toStr(row.delivery_name));
      setDeliveryDescription(toStr(row.delivery_description));
      setNameError("");
    } else {
      setDeliveryName("");
      setDeliveryDescription("");
      setNameError("");
    }
  }, [open, mode, row]);

  function validate() {
    if (!deliveryName.trim()) return "Delivery Name is required";
    if (nameError) return nameError;
    return null;
  }

  async function submit() {
    const msg = validate();
    if (msg) {
      toast.error(msg);
      return;
    }

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
  }

  const title = mode === "create" ? "Add Delivery Term" : "Edit Delivery Term";
  const primaryText = mode === "create" ? "Create" : "Save Changes";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Delivery Name <span className="text-destructive">*</span>
            </label>
            <Input
              value={deliveryName}
              onChange={(e) => setDeliveryName(e.target.value)}
              placeholder="Enter delivery name..."
              className={nameError ? "border-destructive" : ""}
            />
            {nameError && (
              <p className="text-sm text-destructive">{nameError}</p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Description</label>
            <Textarea
              value={deliveryDescription}
              onChange={(e) => setDeliveryDescription(e.target.value)}
              placeholder="Enter description (optional)..."
              className="min-h-[100px]"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="outline"
              className="cursor-pointer"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button 
              className="cursor-pointer" 
              onClick={submit} 
              disabled={!!nameError || isCheckingName}
            >
              {primaryText}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
