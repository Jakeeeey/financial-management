"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export function RejectDialog(props: {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    onConfirm: (reason: string) => void;
    loading?: boolean;
}) {
    const [reason, setReason] = React.useState("");

    React.useEffect(() => {
        if (!props.open) setReason("");
    }, [props.open]);

    return (
        <Dialog open={props.open} onOpenChange={props.onOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Reject Request</DialogTitle>
                </DialogHeader>

                <div className="space-y-2">
                    <Label>Reject Reason</Label>
                    <Textarea
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Enter reason..."
                        rows={4}
                    />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" onClick={() => props.onOpenChange(false)} disabled={props.loading}>
                        Cancel
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={() => props.onConfirm(reason.trim())}
                        disabled={props.loading || !reason.trim()}
                    >
                        Reject
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
