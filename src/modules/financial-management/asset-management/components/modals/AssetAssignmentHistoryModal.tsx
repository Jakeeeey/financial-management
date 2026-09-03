"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

import { AssetTableData, AssetAssignment } from "../../types";
import { assetService } from "../../services/assetService";

interface AssetAssignmentHistoryModalProps {
  asset: AssetTableData | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function AssetAssignmentHistoryModal({
  asset,
  isOpen,
  onClose,
}: AssetAssignmentHistoryModalProps) {
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<AssetAssignment[]>([]);

  useEffect(() => {
    if (isOpen && asset) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(true);
      assetService
        .getAssetAssignments(asset.id)
        .then((data) => setHistory(data))
        .catch((err) => console.error(err))
        .finally(() => setLoading(false));
    } else {
      setHistory([]);
    }
  }, [isOpen, asset]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Assignment History</DialogTitle>
          <DialogDescription>
            Historical assignment records for <strong>{asset?.item_name}</strong>.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : history.length === 0 ? (
          <div className="text-center p-8 text-muted-foreground">
            No assignment history found for this asset.
          </div>
        ) : (
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Assigned To</TableHead>
                  <TableHead>Assigned Date</TableHead>
                  <TableHead>Expected Return</TableHead>
                  <TableHead>Returned Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Cond (Out / In)</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((record) => (
                  <TableRow key={record.assignment_id}>
                    <TableCell className="font-medium">
                      {record.user_name || `User ${record.user_id}`}
                    </TableCell>
                    <TableCell>
                      {format(new Date(record.assigned_date), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>
                      {record.expected_return_date
                        ? format(new Date(record.expected_return_date), "MMM d, yyyy")
                        : "---"}
                    </TableCell>
                    <TableCell>
                      {record.actual_return_date
                        ? format(new Date(record.actual_return_date), "MMM d, yyyy")
                        : "---"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          record.assignment_status === "Assigned"
                            ? "default"
                            : record.assignment_status === "Returned"
                            ? "secondary"
                            : "destructive"
                        }
                      >
                        {record.assignment_status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-xs">
                        <span className="text-muted-foreground">Out:</span> {record.condition_on_assignment || "N/A"}
                        <br />
                        <span className="text-muted-foreground">In:</span> {record.condition_on_return || "N/A"}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[150px] truncate" title={record.notes || ""}>
                      {record.notes || "---"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
