"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ConfirmDeleteDialogProps {
  open: boolean;
  title: string;
  description: string;
  isSaving: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
}

/** The delete confirmation both tables share; the change log keeps the deleted values. */
export function ConfirmDeleteDialog({
  open,
  title,
  description,
  isSaving,
  onOpenChange,
  onConfirm,
}: ConfirmDeleteDialogProps) {
  const [alert, setAlert] = useState<string | null>(null);

  async function confirm() {
    if (isSaving) return;
    setAlert(null);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch (error) {
      setAlert(error instanceof Error ? error.message : "The row was not deleted.");
    }
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next && isSaving) return;
        if (!next) setAlert(null);
        onOpenChange(next);
      }}
    >
      <AlertDialogContent className="w-[95vw] rounded-2xl sm:max-w-[480px]">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>

        {alert ? (
          <Alert variant="destructive">
            <AlertDescription>{alert}</AlertDescription>
          </Alert>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSaving}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={isSaving}
            onClick={(event) => {
              event.preventDefault();
              void confirm();
            }}
            className="min-h-11 md:min-h-0"
          >
            {isSaving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
