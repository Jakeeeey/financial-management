"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EditPayeeForm } from "../forms/edit-payee-form";
import { Payee } from "../../types/payee.schema";

interface EditPayeeModalProps {
  payee: Payee | null;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function EditPayeeModal({
  payee,
  open,
  onClose,
  onSuccess,
}: EditPayeeModalProps) {
  if (!payee) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Payee</DialogTitle>
          <DialogDescription>
            Update the information for {payee.supplier_name}.
          </DialogDescription>
        </DialogHeader>

        <EditPayeeForm
          payee={payee}
          onSuccess={() => {
            onSuccess();
            onClose();
          }}
          onCancel={onClose}
        />
      </DialogContent>
    </Dialog>
  );
}
