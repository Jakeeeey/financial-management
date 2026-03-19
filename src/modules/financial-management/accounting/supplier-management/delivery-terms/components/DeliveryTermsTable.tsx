"use client";

import * as React from "react";
import type { DeliveryTermRow } from "../types";
import * as api from "../providers/fetchProvider";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

function UserCell({ userId }: { userId: number | null }) {
  const [userName, setUserName] = React.useState<string>("-");
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!userId) {
      console.log("⚠️  UserCell: userId is null or 0");
      setUserName("-");
      setLoading(false);
      return;
    }

    console.log(`🔄 UserCell: Loading user info for userId=${userId}`);

    const loadUser = async () => {
      try {
        console.log(`🔄 UserCell: Calling fetchUserInfo for userId=${userId}`);
        const user = await api.fetchUserInfo(userId);
        console.log(`✅ UserCell: Received user data:`, user);
        
        const displayName = api.getUserDisplayName(user);
        console.log(`✅ UserCell: displayName="${displayName}"`);
        
        setUserName(displayName);
      } catch (e) {
        console.error(`❌ UserCell: Error loading user:`, e);
        setUserName("-");
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, [userId]);

  if (loading) {
    return <Skeleton className="h-4 w-[100px]" />;
  }

  return userName;
}

export default function DeliveryTermsTable(props: {
  rows: DeliveryTermRow[];
  loading: boolean;
  onEdit: (row: DeliveryTermRow) => void;
  onView: (row: DeliveryTermRow) => void;
}) {
  const { rows, loading, onEdit, onView } = props;

  return (
    <div className="w-full overflow-hidden rounded-md border bg-background">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[60px]">No.</TableHead>
            <TableHead className="w-[280px]">Name</TableHead>
            <TableHead className="flex-1">Description</TableHead>
            <TableHead className="w-[160px]">Created By</TableHead>
            <TableHead className="w-[160px]">Updated By</TableHead>
            <TableHead className="w-[100px] text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {loading ? (
            Array.from({ length: 10 }).map((_, i) => (
              <TableRow key={`sk-${i}`}>
                <TableCell>
                  <Skeleton className="h-4 w-6" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-[220px]" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-[300px]" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-[100px]" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-[100px]" />
                </TableCell>
                <TableCell className="text-right">
                  <Skeleton className="ml-auto h-8 w-20" />
                </TableCell>
              </TableRow>
            ))
          ) : rows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={6}
                className="py-10 text-center text-sm text-muted-foreground"
              >
                No delivery terms found.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((r, index) => (
              <TableRow key={r.id} className="hover:bg-primary/5 transition-colors group">
                <TableCell className="font-medium text-sm group-hover:text-primary transition-colors">{index + 1}</TableCell>
                <TableCell className="font-medium truncate max-w-[200px] group-hover:text-primary transition-colors" title={r.delivery_name}>
                  {r.delivery_name}
                </TableCell>
                <TableCell className="text-sm truncate max-w-[300px] group-hover:text-primary transition-colors" title={r.delivery_description || ""}>
                  {r.delivery_description || "-"}
                </TableCell>
                <TableCell className="text-sm">
                  <UserCell userId={typeof r.created_by === "number" ? r.created_by : null} />
                </TableCell>
                <TableCell className="text-sm">
                  <UserCell userId={typeof r.updated_by === "number" ? r.updated_by : null} />
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="cursor-pointer hover:border-primary hover:text-primary hover:bg-primary/10 transition-colors"
                      onClick={() => onView(r)}
                    >
                      View
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="cursor-pointer hover:border-primary hover:text-primary hover:bg-primary/10 transition-colors"
                      onClick={() => onEdit(r)}
                    >
                      Edit
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
