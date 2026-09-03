"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";

interface AttributeCreateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (data: { name: string }) => Promise<void>;
}

export function AttributeCreateModal({
  open,
  onOpenChange,
  onSaved,
}: AttributeCreateModalProps) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSaved({ name: name.trim() });
      setName("");
      onOpenChange(false);
    } catch {
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle>Add Attribute</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="attr-name">Attribute Name *</Label>
            <Input
              id="attr-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Color, Size, Brand"
              required
              className="w-full sm:max-w-md truncate min-w-0 overflow-hidden"
            />
          </div>
          <DialogFooter className="gap-2 pt-2">
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={saving || !name.trim()}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}