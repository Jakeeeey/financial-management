"use client";

import * as React from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface CertificationModalProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
}

export function CertificationModal({ isOpen, onOpenChange }: CertificationModalProps) {
    const [certifiedBy, setCertifiedBy] = React.useState("");
    const [role, setRole] = React.useState("finance-manager");
    const [remarks, setRemarks] = React.useState("");

    const handleConfirm = () => {
        if (!certifiedBy) {
            toast.error("Please enter the approver name");
            return;
        }
        
        // Mocking the success state
        toast.success("Statement certified successfully!", {
            description: `Certified by ${certifiedBy} (${role})`,
        });
        
        onOpenChange(false);
        // Reset form
        setCertifiedBy("");
        setRemarks("");
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px] p-6 rounded-xl border-border shadow-2xl">
                <DialogHeader className="mb-4">
                    <DialogTitle className="text-xl font-bold tracking-tight">Certify Statement</DialogTitle>
                </DialogHeader>
                
                {/* Info Box */}
                <div className="bg-secondary/30 p-4 rounded-lg border border-border/50 text-sm text-muted-foreground leading-relaxed mb-4">
                    Confirm that the statement has been reviewed and is ready for certification.
                </div>

                {/* Form Fields */}
                <div className="grid gap-5">
                    <div className="grid gap-2">
                        <Label htmlFor="certified-by" className="text-sm font-bold text-foreground/80">
                            Certified By
                        </Label>
                        <Input
                            id="certified-by"
                            value={certifiedBy}
                            onChange={(e) => setCertifiedBy(e.target.value)}
                            placeholder="Enter approver name"
                            className="h-11 rounded-xl border-input bg-background/50 focus:ring-primary/20"
                        />
                    </div>
                    
                    <div className="grid gap-2">
                        <Label htmlFor="role" className="text-sm font-bold text-foreground/80">
                            Role
                        </Label>
                        <Select value={role} onValueChange={setRole}>
                            <SelectTrigger id="role" className="h-11 rounded-xl border-input bg-background/50 focus:ring-primary/20">
                                <SelectValue placeholder="Select role" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl">
                                <SelectItem value="finance-manager">Finance Manager</SelectItem>
                                <SelectItem value="chief-accountant">Chief Accountant</SelectItem>
                                <SelectItem value="cfo">CFO</SelectItem>
                                <SelectItem value="audit-manager">Audit Manager</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="remarks" className="text-sm font-bold text-foreground/80">
                            Remarks
                        </Label>
                        <Input
                            id="remarks"
                            value={remarks}
                            onChange={(e) => setRemarks(e.target.value)}
                            placeholder="Optional remarks"
                            className="h-11 rounded-xl border-input bg-background/50 focus:ring-primary/20"
                        />
                    </div>
                </div>

                <div className="mt-8 flex justify-end">
                    <Button 
                        onClick={handleConfirm} 
                        className="px-8 h-11 text-xs font-bold rounded-full bg-primary text-primary-foreground hover:bg-primary/90 shadow-md transition-all active:scale-[0.98]"
                    >
                        Confirm Certification
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
