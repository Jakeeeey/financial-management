"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useFinancialPerformance } from "../hooks/useFinancialPerformance";

interface CertificationModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CertificationModal({ isOpen, onOpenChange }: CertificationModalProps) {
  const [agreed, setAgreed] = useState(false);
  const [notes, setNotes] = useState("");
  const { certifyStatement, isLoading: isCertifying } = useFinancialPerformance();

  const handleCertify = async () => {
    if (!agreed) return;
    const success = await certifyStatement(notes);
    if (success) {
      onOpenChange(false);
      setAgreed(false);
      setNotes("");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Certify Statement of Financial Performance</DialogTitle>
          <DialogDescription>
            You are about to formally certify this period's Financial Performance statement. This action indicates that the reported revenues, expenses, and net income have been reviewed and verified for accuracy.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="notes">Certification Notes (Optional)</Label>
            <Textarea
              id="notes"
              placeholder="Add any remarks or context regarding this period's performance..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="resize-none"
              rows={3}
            />
          </div>
          <div className="flex items-center space-x-2 bg-muted/30 p-3 rounded-lg border border-border">
            <Checkbox
              id="terms"
              checked={agreed}
              onCheckedChange={(checked) => setAgreed(!!checked)}
            />
            <label
              htmlFor="terms"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
            >
              I confirm the accuracy and integrity of these figures.
            </label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleCertify} disabled={!agreed || isCertifying}>
            {isCertifying ? "Certifying..." : "Confirm & Certify"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
