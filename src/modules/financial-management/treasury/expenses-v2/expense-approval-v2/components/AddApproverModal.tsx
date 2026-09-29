"use client";

import React, { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { UserInfo, DivisionInfo, ExpenseApprover } from "../types";
import { User, Layers, AlertCircle } from "lucide-react";

interface AddApproverModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: UserInfo[];
  divisions: DivisionInfo[];
  existingApprovers: ExpenseApprover[];
  defaultDivisionId?: number;
  onSave: (data: {
    approver_id: number;
    division_id: number;
    approver_hierarchy: number;
    created_at: string;
  }) => Promise<void>;
}

export const AddApproverModal: React.FC<AddApproverModalProps> = ({
  isOpen,
  onClose,
  users,
  divisions,
  existingApprovers,
  defaultDivisionId,
  onSave,
}) => {
  const [selectedDivisionId, setSelectedDivisionId] = useState<string>(
    defaultDivisionId ? String(defaultDivisionId) : ""
  );
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [hierarchyInput, setHierarchyInput] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync selectedDivisionId if defaultDivisionId changes
  React.useEffect(() => {
    if (defaultDivisionId) {
      setSelectedDivisionId(String(defaultDivisionId));
    }
  }, [defaultDivisionId]);

  // Compute next suggested hierarchy level for selected division
  const suggestedHierarchy = useMemo(() => {
    if (!selectedDivisionId) return 1;
    const divId = parseInt(selectedDivisionId, 10);
    const divApprovers = existingApprovers.filter(
      (a) =>
        (typeof a.division_id === "object"
          ? a.division_id.division_id
          : a.division_id) === divId && !a.is_deleted
    );
    if (divApprovers.length === 0) return 1;
    const maxH = Math.max(...divApprovers.map((a) => a.approver_hierarchy || 0));
    return maxH + 1;
  }, [selectedDivisionId, existingApprovers]);

  // Update hierarchyInput when suggestedHierarchy changes if user hasn't typed
  React.useEffect(() => {
    if (selectedDivisionId) {
      setHierarchyInput(String(suggestedHierarchy));
    }
  }, [selectedDivisionId, suggestedHierarchy]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!selectedDivisionId) {
      setErrorMsg("Please select a Division.");
      return;
    }
    if (!selectedUserId) {
      setErrorMsg("Please select an Approver User.");
      return;
    }

    const hNum = parseInt(hierarchyInput, 10);
    if (isNaN(hNum) || hNum <= 0) {
      setErrorMsg("Hierarchy level must be a positive integer greater than 0.");
      return;
    }

    // Check duplicate hierarchy level in division
    const divId = parseInt(selectedDivisionId, 10);
    const isDuplicate = existingApprovers.some(
      (a) =>
        (typeof a.division_id === "object"
          ? a.division_id.division_id
          : a.division_id) === divId &&
        a.approver_hierarchy === hNum &&
        !a.is_deleted
    );

    if (isDuplicate) {
      setErrorMsg(`Hierarchy Level ${hNum} is already assigned in this division.`);
      return;
    }

    // Direct literal PH timestamp format: YYYY-MM-DDTHH:mm:ss.sssZ (without +8h shift)
    const now = new Date();
    const literalPhTimestamp = new Date(
      now.getTime() - now.getTimezoneOffset() * 60000
    )
      .toISOString()
      .replace("Z", "+08:00");

    try {
      setIsSubmitting(true);
      await onSave({
        approver_id: parseInt(selectedUserId, 10),
        division_id: divId,
        approver_hierarchy: hNum,
        created_at: literalPhTimestamp,
      });
      setIsSubmitting(false);
      onClose();
      setSelectedUserId("");
      setHierarchyInput("");
    } catch (err: unknown) {
      setIsSubmitting(false);
      const message = err instanceof Error ? err.message : "Failed to save approver.";
      setErrorMsg(message);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md bg-card border-border/80 text-foreground">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <User className="w-4 h-4 text-primary" /> Assign Division Approver
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2 text-xs">
          {errorMsg && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-500 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Division Select */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Division</Label>
            <Select
              value={selectedDivisionId}
              onValueChange={(v) => setSelectedDivisionId(v)}
            >
              <SelectTrigger className="bg-background/60 border-border/60 text-xs">
                <SelectValue placeholder="Select Division" />
              </SelectTrigger>
              <SelectContent className="z-[200]">
                {divisions.map((d) => (
                  <SelectItem
                    key={d.division_id}
                    value={String(d.division_id)}
                    className="text-xs"
                  >
                    {d.division_name} ({d.division_code || `DIV-${d.division_id}`})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* User Select */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Approver User</Label>
            <Select
              value={selectedUserId}
              onValueChange={(v) => setSelectedUserId(v)}
            >
              <SelectTrigger className="bg-background/60 border-border/60 text-xs">
                <SelectValue placeholder="Select User" />
              </SelectTrigger>
              <SelectContent className="z-[200] max-h-56">
                {users.map((u) => (
                  <SelectItem
                    key={u.user_id}
                    value={String(u.user_id)}
                    className="text-xs"
                  >
                    {u.user_fname} {u.user_lname} ({u.user_position || `ID: ${u.user_id}`})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Hierarchy Level Input */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <Label className="text-xs font-medium flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-primary" /> Approver Hierarchy Level
              </Label>
              <span className="text-[10px] text-muted-foreground">
                Suggested: Level {suggestedHierarchy}
              </span>
            </div>
            <Input
              type="number"
              min={1}
              step={1}
              placeholder="e.g. 1 (Level 1), 2 (Level 2)"
              value={hierarchyInput}
              onChange={(e) => setHierarchyInput(e.target.value)}
              className="bg-background/60 border-border/60 text-xs font-mono"
            />
            <p className="text-[10px] text-muted-foreground italic">
              Must be a positive integer &gt; 0. Defines sequential approval order.
            </p>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting}
              className="text-xs bg-primary text-primary-foreground font-semibold"
            >
              {isSubmitting ? "Saving..." : "Assign Approver"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
