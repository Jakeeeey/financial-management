"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  onSaved: (data: { name: string; display_type: string }) => Promise<void>;
}

export function AttributeCreateModal({
  open,
  onOpenChange,
  onSaved,
}: AttributeCreateModalProps) {
  const [name, setName] = useState("");
  const [displayType, setDisplayType] = useState("select");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSaved({ name: name.trim(), display_type: displayType });
      setName("");
      setDisplayType("select");
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
          <div className="space-y-2">
            <Label htmlFor="attr-type">Display Type</Label>
            <Select value={displayType} onValueChange={setDisplayType}>
              <SelectTrigger id="attr-type" className="w-full sm:max-w-[200px]">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent className="!max-h-[160px] !overflow-y-auto" position="popper">
                <SelectItem value="select">Select</SelectItem>
                <SelectItem value="radio">Radio</SelectItem>
                <SelectItem value="color">Color</SelectItem>
                <SelectItem value="text">Text</SelectItem>
              </SelectContent>
            </Select>
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
