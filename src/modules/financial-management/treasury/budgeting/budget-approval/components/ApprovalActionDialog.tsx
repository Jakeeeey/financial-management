"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Ban } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ApprovalActionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (remarks: string) => void;
  type: "approve" | "reject" | "supplement";
  count: number;
  loading?: boolean;
}

export function ApprovalActionDialog({
  isOpen,
  onClose,
  onConfirm,
  type,
  count,
  loading = false,
}: ApprovalActionDialogProps) {
  const [feedback, setFeedback] = React.useState("");

  const configMap = {
    approve: {
      title: "Confirm Approval",
      description: `You are about to approve ${count} budget entry(ies). This action will move them to the Approved status and allow further transaction processing.`,
      icon: <ShieldCheck className="h-6 w-6 text-emerald-600" />,
      iconBg: "bg-emerald-50",
      buttonClass: "bg-emerald-600 hover:bg-emerald-700 text-white",
      buttonText: "Approve Now",
      badge: "Approval",
    },
    reject: {
      title: "Confirm Rejection",
      description: `You are about to reject ${count} budget entry(ies). Are you sure you want to proceed with this action?`,
      icon: <Ban className="h-6 w-6 text-destructive" />,
      iconBg: "bg-destructive/10",
      buttonClass: "bg-destructive hover:bg-destructive/90 text-white",
      buttonText: "Reject Budget",
      badge: "Rejection",
    },
  };

  const config = configMap[type === "reject" ? "reject" : "approve"];

  const handleConfirm = () => {
    onConfirm(feedback.trim());
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open && !loading) onClose();
    }}>
      <DialogContent className="max-w-md p-0 overflow-hidden rounded-2xl border-border/40 shadow-2xl">
        <div className="bg-muted/20 p-6 border-b border-border/50">
          <div className="flex items-center gap-4">
            <div className={`p-3 ${config.iconBg} rounded-2xl shadow-sm`}>
              {config.icon}
            </div>
            <div className="flex-1">
              <Badge variant="outline" className="mb-1 text-[8px] font-black uppercase tracking-widest bg-background">
                {config.badge} Action
              </Badge>
              <DialogTitle className="text-xl font-black tracking-tighter uppercase leading-none">
                {config.title}
              </DialogTitle>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <DialogDescription className="text-sm font-medium leading-relaxed">
            {config.description}
          </DialogDescription>

          <div className="space-y-1.5">
            <label className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">
              Feedback / Remarks (Optional)
            </label>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Enter optional feedback or notes for this decision..."
              rows={3}
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
            />
          </div>
        </div>

        <DialogFooter className="p-4 bg-muted/10 border-t border-border/40 flex items-center gap-2">
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={loading}
            className="flex-1 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-muted/50"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={loading}
            className={`flex-[1.5] h-10 rounded-xl text-xs font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all ${config.buttonClass}`}
          >
            {loading ? "Processing..." : config.buttonText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
