"use client";

import React, { useRef, useState } from "react";
import { AlertCircle, FileText, Loader2, Upload, X } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ClearDepositPayload, DepositSlip } from "../types";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

interface Props {
    open: boolean;
    slip: DepositSlip | null;
    isSubmitting: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (payload: ClearDepositPayload) => Promise<void>;
}

export function ClearDepositDialog({ open, slip, isSubmitting, onOpenChange, onSubmit }: Props) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [depositReference, setDepositReference] = useState(slip?.depositReference || "");
    const [validationDocument, setValidationDocument] = useState<File | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0] || null;
        if (!file) return;

        const isImage = file.type.startsWith("image/");
        const isPdf = file.type === "application/pdf";
        if (!isImage && !isPdf) {
            setValidationDocument(null);
            setError("Unsupported validation document type. Upload an image or PDF.");
            event.target.value = "";
            return;
        }
        if (file.size === 0) {
            setValidationDocument(null);
            setError("Validation document cannot be empty.");
            event.target.value = "";
            return;
        }
        if (file.size > MAX_FILE_SIZE) {
            setValidationDocument(null);
            setError("Validation document exceeds the 10 MB limit.");
            event.target.value = "";
            return;
        }

        setValidationDocument(file);
        setError(null);
    };

    const removeFile = () => {
        setValidationDocument(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const reference = depositReference.trim();
        if (!reference && !validationDocument) {
            setError("Enter a deposit reference number or upload a validation document.");
            return;
        }

        setError(null);
        try {
            await onSubmit({ depositReference: reference, validationDocument });
            onOpenChange(false);
        } catch (submitError: unknown) {
            setError(submitError instanceof Error ? submitError.message : "Unable to clear deposit.");
        }
    };

    if (!slip) return null;

    return (
        <Dialog open={open} onOpenChange={(nextOpen) => !isSubmitting && onOpenChange(nextOpen)}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className="uppercase">Clear Deposit {slip.depositNo}</DialogTitle>
                    <DialogDescription>
                        Record the validated bank deposit slip before marking this deposit as cleared.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="space-y-2">
                        <Label htmlFor="deposit-reference">Bank Deposit Slip Reference Number</Label>
                        <Input
                            id="deposit-reference"
                            value={depositReference}
                            onChange={(event) => setDepositReference(event.target.value)}
                            maxLength={100}
                            placeholder="Enter the bank deposit slip reference"
                            disabled={isSubmitting}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="validation-document">Validated Deposit Slip</Label>
                        <Input
                            ref={fileInputRef}
                            id="validation-document"
                            type="file"
                            accept="image/*,application/pdf"
                            onChange={handleFileChange}
                            disabled={isSubmitting}
                        />
                        <p className="text-xs text-muted-foreground">One image or PDF, maximum 10 MB.</p>

                        {validationDocument && (
                            <div className="flex items-center justify-between rounded-md border bg-muted/20 px-3 py-2 text-sm">
                                <span className="flex min-w-0 items-center gap-2">
                                    <FileText className="size-4 shrink-0 text-primary" />
                                    <span className="truncate">{validationDocument.name}</span>
                                </span>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="size-7 shrink-0"
                                    onClick={removeFile}
                                    disabled={isSubmitting}
                                    aria-label="Remove validation document"
                                >
                                    <X className="size-4" />
                                </Button>
                            </div>
                        )}
                    </div>

                    <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                        At least one of the reference number or validation document is required.
                    </div>

                    {error && (
                        <div role="alert" className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                            <AlertCircle className="mt-0.5 size-4 shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={isSubmitting}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700" disabled={isSubmitting}>
                            {isSubmitting ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Upload className="mr-2 size-4" />}
                            Confirm Clear Deposit
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
