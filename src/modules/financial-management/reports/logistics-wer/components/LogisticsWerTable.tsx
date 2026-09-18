"use client";

import { Eye, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { LogisticsWerDispatchPlanSummary } from "../types";
import { dispatchPlanStatusClassName } from "../utils/status";

function formatMoney(value: number): string {
  return `₱${value.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleDateString("en-PH", { timeZone: "UTC", year: "numeric", month: "short", day: "numeric" });
}

interface LogisticsWerTableProps {
  rows: LogisticsWerDispatchPlanSummary[];
  loading: boolean;
  onViewDetails: (row: LogisticsWerDispatchPlanSummary) => void;
}

export function LogisticsWerTable({ rows, loading, onViewDetails }: LogisticsWerTableProps) {
  return (
    <Card className="overflow-hidden shadow-sm">
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Dispatch plan</TableHead>
                <TableHead>Dispatch date</TableHead>
                <TableHead>Driver</TableHead>
                <TableHead>Vehicle</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Planned amount</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                    <Loader2 className="mr-2 inline-block size-4 animate-spin" />
                    Loading dispatch plans…
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                    No dispatch plans found for the selected filters.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-semibold">{row.docNo}</TableCell>
                    <TableCell>{formatDate(row.dispatchDate)}</TableCell>
                    <TableCell>{row.driverName || "Unassigned"}</TableCell>
                    <TableCell>{row.vehicleName || "Unassigned"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={dispatchPlanStatusClassName(row.status)}>
                        {row.status || "Unknown"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">{formatMoney(row.amount)}</TableCell>
                    <TableCell className="text-right">
                      <Button type="button" variant="outline" size="sm" onClick={() => onViewDetails(row)}>
                        <Eye className="size-3.5" />
                        Details
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
