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
  loading = false
}: ApprovalActionDialogProps) {

  const config = {
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
  }[type as "approve" | "reject"];

  const handleConfirm = () => {
    onConfirm("");
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
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

        </div>

        <DialogFooter className="p-4 bg-muted/10 border-t border-border/40 flex items-center gap-2">
          <Button
            variant="ghost"
            onClick={onClose}
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
