"use client";

import { useMemo, useState } from "react";
import { FileDown, Loader2, Pencil, Plus, Trash2 } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatNumber } from "@/lib/utils";
import {
  DIRECTION_LABELS,
  PAGE_SIZE,
  PERIOD_KEYS,
  PERIOD_LABELS,
  WITHHOLDING_LABELS,
  certificateStatusLabel,
} from "../constants";
import type { CertificateBody } from "../schemas";
import type { CertificateRow, ExpectedPeriod, PrefillResult } from "../types";
import { CertificateDetailDialog } from "./CertificateDetailDialog";
import { CertificateDialog } from "./CertificateDialog";
import { ConfirmDeleteDialog } from "./ConfirmDeleteDialog";
import { StatusBadge } from "./StatusBadge";
import { TablePager } from "./TablePager";

const SOURCE_LABELS: Record<string, string> = {
  MANUAL: "Manual",
  SALES_INVOICE: "Sales invoice",
  PURCHASE_ORDER: "Purchase order",
};

const COLUMN_COUNT = 11;

type Row =
  | { kind: "certificate"; key: string; certificate: CertificateRow }
  | { kind: "gap"; key: string; period: ExpectedPeriod };

function periodOrder(periodKey: string): number {
  return PERIOD_KEYS.indexOf(periodKey as (typeof PERIOD_KEYS)[number]);
}

interface CertificatesTabProps {
  companyId: number;
  year: number;
  companyOptions: { value: string; label: string; searchText?: string; description?: string }[];
  certificates: CertificateRow[];
  expected: ExpectedPeriod[];
  isLoading: boolean;
  isSaving: boolean;
  onCompanyChange: (companyId: number) => void;
  onCreate: (body: CertificateBody) => Promise<void>;
  onUpdate: (id: number, body: CertificateBody) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  onPrefill: () => Promise<PrefillResult>;
}

export function CertificatesTab({
  companyId,
  year,
  companyOptions,
  certificates,
  expected,
  isLoading,
  isSaving,
  onCompanyChange,
  onCreate,
  onUpdate,
  onDelete,
  onPrefill,
}: CertificatesTabProps) {
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CertificateRow | null>(null);
  const [deleting, setDeleting] = useState<CertificateRow | null>(null);
  const [viewing, setViewing] = useState<CertificateRow | null>(null);
  const [prefillNote, setPrefillNote] = useState<string | null>(null);
  const [prefillError, setPrefillError] = useState<string | null>(null);

  const rows = useMemo<Row[]>(() => {
    const certificatesRows: Row[] = certificates.map((certificate) => ({
      kind: "certificate",
      key: `c-${certificate.id}`,
      certificate,
    }));

    // A past period the ledger says should carry withholding, with nothing recorded.
    const gapRows: Row[] = expected
      .filter((period) => period.status === "NOT_ENTERED")
      .map((period) => ({ kind: "gap", key: `g-${period.direction}-${period.periodKey}`, period }));

    return [...certificatesRows, ...gapRows].sort((left, right) => {
      const leftPeriod = left.kind === "certificate" ? left.certificate.periodKey : left.period.periodKey;
      const rightPeriod = right.kind === "certificate" ? right.certificate.periodKey : right.period.periodKey;
      const byPeriod = periodOrder(leftPeriod) - periodOrder(rightPeriod);
      if (byPeriod !== 0) return byPeriod;

      const leftDirection = left.kind === "certificate" ? left.certificate.direction : left.period.direction;
      const rightDirection = right.kind === "certificate" ? right.certificate.direction : right.period.direction;
      if (leftDirection !== rightDirection) return leftDirection === "RECEIVED" ? -1 : 1;

      const leftName = left.kind === "certificate" ? left.certificate.counterpartyName : "";
      const rightName = right.kind === "certificate" ? right.certificate.counterpartyName : "";
      return leftName.localeCompare(rightName);
    });
  }, [certificates, expected]);

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const visible = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const withheldTotal = certificates.reduce((sum, certificate) => sum + certificate.taxWithheld, 0);

  async function prefill() {
    setPrefillError(null);
    setPrefillNote(null);
    try {
      const result = await onPrefill();
      setPrefillNote(`Prefilled ${result.created} certificate(s); skipped ${result.skipped} already recorded.`);
      setPage(1);
    } catch (error) {
      setPrefillError(error instanceof Error ? error.message : "The prefill failed.");
    }
  }

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(certificate: CertificateRow) {
    setEditing(certificate);
    setDialogOpen(true);
  }

  return (
    <section
      aria-label="2307 certificates"
      className="overflow-hidden rounded-2xl border border-border/50 bg-card shadow-sm"
    >
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 px-4 py-3">
        <h2 className="text-sm font-semibold">2307 certificates</h2>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="tabular-nums text-[11px]">
            {formatNumber(certificates.length)} certificates
          </Badge>
          <Badge variant="outline" className="tabular-nums text-[11px]">
            {formatCurrency(withheldTotal)} withheld
          </Badge>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void prefill()}
            disabled={isSaving || isLoading}
            className="min-h-11 md:min-h-0"
          >
            {isSaving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <FileDown className="mr-2 size-4" />}
            Prefill from invoices
          </Button>
          <Button type="button" size="sm" onClick={openCreate} className="min-h-11 md:min-h-0">
            <Plus className="mr-2 size-4" />
            Add certificate
          </Button>
        </div>
      </header>

      {prefillError ? (
        <div className="px-4 pb-3">
          <Alert variant="destructive">
            <AlertDescription>{prefillError}</AlertDescription>
          </Alert>
        </div>
      ) : null}

      {prefillNote ? (
        <div className="px-4 pb-3">
          <Alert>
            <AlertDescription>{prefillNote}</AlertDescription>
          </Alert>
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <Table aria-label="2307 certificates">
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[220px]">Issuer / payee</TableHead>
              <TableHead className="min-w-[130px]">TIN</TableHead>
              <TableHead>Period</TableHead>
              <TableHead className="min-w-[140px]">Income type</TableHead>
              <TableHead className="text-right">Income</TableHead>
              <TableHead className="text-right">Rate</TableHead>
              <TableHead className="text-right">Withheld</TableHead>
              <TableHead>Received</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 4 }).map((_, index) => (
                <TableRow key={`skeleton-${index}`}>
                  <TableCell colSpan={COLUMN_COUNT}>
                    <Skeleton className="h-10 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : visible.length === 0 ? (
              <TableRow>
                <TableCell colSpan={COLUMN_COUNT} className="px-4 py-12 text-center text-sm text-muted-foreground">
                  No certificate is recorded for {year}.
                </TableCell>
              </TableRow>
            ) : (
              visible.map((row) =>
                row.kind === "certificate" ? (
                  <TableRow
                    key={row.key}
                    tabIndex={0}
                    aria-label={`Open certificate from ${row.certificate.counterpartyName}`}
                    className="cursor-pointer focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset"
                    onClick={() => setViewing(row.certificate)}
                    onKeyDown={(event) => {
                      if (event.target !== event.currentTarget) return;
                      if (event.key !== "Enter" && event.key !== " ") return;
                      event.preventDefault();
                      setViewing(row.certificate);
                    }}
                  >
                    <TableCell>
                      <div className="max-w-[240px] truncate font-medium" title={row.certificate.counterpartyName}>
                        {row.certificate.counterpartyName}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {DIRECTION_LABELS[row.certificate.direction]}
                      </div>
                    </TableCell>
                    <TableCell className="tabular-nums">
                      <span className="block max-w-[130px] truncate" title={row.certificate.counterpartyTin ?? ""}>
                        {row.certificate.counterpartyTin ?? "—"}
                      </span>
                    </TableCell>
                    <TableCell>{PERIOD_LABELS[row.certificate.periodKey]}</TableCell>
                    <TableCell>
                      <span className="block max-w-[140px] truncate" title={WITHHOLDING_LABELS[row.certificate.incomeType]}>
                        {WITHHOLDING_LABELS[row.certificate.incomeType]}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(row.certificate.incomeAmount)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(row.certificate.taxRate, "en-PH", 2)}%</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(row.certificate.taxWithheld)}</TableCell>
                    <TableCell className="tabular-nums">{row.certificate.dateReceived ?? "—"}</TableCell>
                    <TableCell>{SOURCE_LABELS[row.certificate.source] ?? row.certificate.source}</TableCell>
                    <TableCell>
                      <StatusBadge
                        status={row.certificate.status}
                        label={certificateStatusLabel(row.certificate.status)}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Edit certificate from ${row.certificate.counterpartyName}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            openEdit(row.certificate);
                          }}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Delete certificate from ${row.certificate.counterpartyName}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            setDeleting(row.certificate);
                          }}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  <TableRow key={row.key} className="bg-muted/30">
                    <TableCell>
                      <div className="font-medium text-muted-foreground">No certificate recorded</div>
                      <div className="text-[11px] text-muted-foreground">{DIRECTION_LABELS[row.period.direction]}</div>
                    </TableCell>
                    <TableCell>—</TableCell>
                    <TableCell>{PERIOD_LABELS[row.period.periodKey]}</TableCell>
                    <TableCell>—</TableCell>
                    <TableCell className="text-right">—</TableCell>
                    <TableCell className="text-right">—</TableCell>
                    <TableCell className="text-right tabular-nums" title="Expected from the ledger">
                      {formatCurrency(row.period.expected)}
                    </TableCell>
                    <TableCell>—</TableCell>
                    <TableCell>—</TableCell>
                    <TableCell>
                      <StatusBadge status={row.period.status} label={certificateStatusLabel(row.period.status)} />
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">expected</TableCell>
                  </TableRow>
                ),
              )
            )}
          </TableBody>
        </Table>
      </div>

      <TablePager
        page={safePage}
        pageCount={pageCount}
        total={rows.length}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
        isLoading={isLoading}
        className="border-t border-border/50 px-4 py-3"
      />

      <CertificateDetailDialog
        certificate={viewing}
        onOpenChange={(next) => {
          if (!next) setViewing(null);
        }}
      />

      <CertificateDialog
        open={dialogOpen}
        certificate={editing}
        companyId={companyId}
        companyOptions={companyOptions}
        onCompanyChange={onCompanyChange}
        year={year}
        isSaving={isSaving}
        onOpenChange={(next) => {
          setDialogOpen(next);
          if (!next) setEditing(null);
        }}
        onSubmit={async (body) => {
          if (editing) {
            await onUpdate(editing.id, body);
          } else {
            await onCreate(body);
          }
          setPage(1);
        }}
      />

      <ConfirmDeleteDialog
        open={deleting !== null}
        title="Delete this certificate?"
        description={
          deleting
            ? `${deleting.counterpartyName}, ${PERIOD_LABELS[deleting.periodKey]}: ${formatCurrency(deleting.taxWithheld)} withheld. The change log keeps the deleted values.`
            : ""
        }
        isSaving={isSaving}
        onOpenChange={(next) => {
          if (!next) setDeleting(null);
        }}
        onConfirm={async () => {
          if (deleting) await onDelete(deleting.id);
        }}
      />
    </section>
  );
}
