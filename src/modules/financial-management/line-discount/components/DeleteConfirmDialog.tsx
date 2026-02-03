// src/modules/financial-management/line-discount/components/DeleteConfirmDialog.tsx
"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title?: string;
  description?: string;
  onConfirm: () => Promise<void>;
};

export default function DeleteConfirmDialog({
  open,
  onOpenChange,
  title = "Delete record",
  description = "This action cannot be undone.",
  onConfirm,
}: Props) {
  const [loading, setLoading] = React.useState(false);

  async function run() {
    try {
      setLoading(true);
      await onConfirm();
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-lg">{title}</DialogTitle>
          <p className="text-sm text-muted-foreground">{description}</p>
        </DialogHeader>
        <Separator />
        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={run} disabled={loading}>
            Delete
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
