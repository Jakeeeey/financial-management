"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export function ApproveDialog(props: {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    onConfirm: () => void;
    loading?: boolean;
    title?: string;
    description?: string;
    children?: React.ReactNode;
}) {
    return (
        <Dialog open={props.open} onOpenChange={props.onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{props.title || "Confirm Approval"}</DialogTitle>
                </DialogHeader>

                {props.description ? (
                    <p className="text-sm text-muted-foreground">{props.description}</p>
                ) : null}

                {props.children}

                <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" onClick={() => props.onOpenChange(false)} disabled={props.loading}>
                        Cancel
                    </Button>
                    <Button onClick={props.onConfirm} disabled={props.loading}>
                        {props.loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Approve
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
