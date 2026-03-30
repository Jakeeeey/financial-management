"use client";

import * as React from "react";
import type { DeliveryTermRow } from "../types";
import * as api from "../providers/fetchProvider";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

function formatDate(iso: string | null | undefined) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
}

function UserCell({ userId }: { userId: number | null }) {
  const [userName, setUserName] = React.useState<string>("-");
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!userId) {
      setUserName("-");
      setLoading(false);
      return;
    }

    const loadUser = async () => {
      try {
        const user = await api.fetchUserInfo(userId);
        setUserName(api.getUserDisplayName(user));
      } catch {
        setUserName("-");
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, [userId]);

  if (loading) {
    return <Skeleton className="h-4 w-[150px]" />;
  }

  return <span className="break-words">{userName}</span>;
}

export default function DeliveryTermsViewDialog(props: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  row: DeliveryTermRow | null;
}) {
  const { open, onOpenChange, row } = props;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>View Delivery Term Details</DialogTitle>
        </DialogHeader>

        {row ? (
          <div className="space-y-6 overflow-y-auto max-h-[calc(90vh-120px)] pr-4">
            {/* ID Section */}
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-2">ID</h3>
              <p className="text-sm">{row.id}</p>
            </div>

            {/* Name Section */}
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-2">Delivery Name</h3>
              <p className="text-base font-medium break-words">{row.delivery_name}</p>
            </div>

            {/* Description Section */}
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-2">Description</h3>
              <p className="text-sm whitespace-pre-wrap break-words">{row.delivery_description || "-"}</p>
            </div>

            {/* Audit Information */}
            <div className="border-t pt-4">
              <h3 className="text-sm font-semibold mb-4">Audit Information</h3>
              
              <div className="grid grid-cols-2 gap-4">
                {/* Created By */}
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground mb-1">Created By</p>
                  <div className="truncate">
                    <UserCell userId={typeof row.created_by === "number" ? row.created_by : null} />
                  </div>
                </div>

                {/* Created At */}
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground mb-1">Created At</p>
                  <p className="text-sm truncate">{formatDate(row.created_at)}</p>
                </div>

                {/* Updated By */}
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground mb-1">Updated By</p>
                  <div className="truncate">
                    <UserCell userId={typeof row.updated_by === "number" ? row.updated_by : null} />
                  </div>
                </div>

                {/* Updated At */}
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground mb-1">Updated At</p>
                  <p className="text-sm truncate">{formatDate(row.updated_at)}</p>
                </div>
              </div>
            </div>

            {/* Close Button */}
            <div className="flex justify-end pt-4 border-t">
              <Button
                variant="outline"
                className="cursor-pointer"
                onClick={() => onOpenChange(false)}
              >
                Close
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-6">
            <p className="text-muted-foreground">No data to display</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
