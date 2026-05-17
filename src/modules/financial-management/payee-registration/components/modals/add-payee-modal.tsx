"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AddPayeeForm } from "../forms/add-payee-form";

interface AddPayeeModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function AddPayeeModal({ open, onClose, onSuccess }: AddPayeeModalProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Payee</DialogTitle>
          <DialogDescription>
            Enter the details of the new payee (Non-Trade) below.
          </DialogDescription>
        </DialogHeader>

        <AddPayeeForm
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
