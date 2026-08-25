"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AddPayeeForm } from "../forms/add-payee-form";
import type { Payee } from "../../types/payee.schema";

interface AddPayeeModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (payee?: Payee) => void | Promise<void>;
  supplierType?: "TRADE" | "NON-TRADE";
  allowSupplierTypeSelect?: boolean;
}

export function AddPayeeModal({
  open,
  onClose,
  onSuccess,
  supplierType = "NON-TRADE",
  allowSupplierTypeSelect = false,
}: AddPayeeModalProps) {
  const supplierTypeLabel = supplierType === "TRADE" ? "Trade" : "Non-Trade";
  const title = allowSupplierTypeSelect ? "Add New Payee" : `Add New ${supplierTypeLabel} Payee`;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {allowSupplierTypeSelect
              ? "Choose whether this payee is Trade or Non-Trade, then enter the details below."
              : `Enter the details of the new ${supplierTypeLabel} payee below.`}
          </DialogDescription>
        </DialogHeader>

        <AddPayeeForm
          key={`${supplierType}-${allowSupplierTypeSelect ? "selectable" : "locked"}`}
          supplierType={supplierType}
          allowSupplierTypeSelect={allowSupplierTypeSelect}
          onSuccess={async (payee) => {
            await onSuccess(payee);
            onClose();
          }}
          onCancel={onClose}
        />
      </DialogContent>
    </Dialog>
  );
}
