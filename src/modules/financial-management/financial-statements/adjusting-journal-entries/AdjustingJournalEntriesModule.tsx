"use client";

import * as React from "react";
import {
  Ban,
  ChevronLeft,
  ChevronRight,
  Eye,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Search,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import type {
  AdjustingEntry,
  AdjustingEntryDetail,
  AdjustingEntryPage,
  AdjustingEntryPayload,
  DepartmentLookup,
  DivisionLookup,
  LookupOption,
} from "./types";
import {
  adjustingJournalEntriesApi,
  fetchCoaOptions,
  fetchDepartmentOptions,
  fetchDivisionOptions,
} from "./services/adjusting-journal-entries.api";

type DetailFormRow = {
  localId: string;
  id: number | null;
  coaId: string;
  debit: string;
  credit: string;
};

type EntryForm = {
  transactionDate: string;
  divisionId: string;
  departmentId: string;
  description: string;
  details: DetailFormRow[];
};

const pageSizes = [10, 20, 50];
const statusOptions = ["All", "Draft", "Posted", "Voided"];

function todayInputValue() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
}

function makeRow(detail?: AdjustingEntryDetail): DetailFormRow {
  return {
    localId: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    id: detail?.id ?? null,
    coaId: detail?.coaId ? String(detail.coaId) : "",
    debit: detail && detail.debit > 0 ? detail.debit.toFixed(2) : "",
    credit: detail && detail.credit > 0 ? detail.credit.toFixed(2) : "",
  };
}

function emptyForm(): EntryForm {
  return {
    transactionDate: todayInputValue(),
    divisionId: "",
    departmentId: "",
    description: "",
    details: [makeRow(), makeRow()],
  };
}

function formFromEntry(entry: AdjustingEntry): EntryForm {
  return {
    transactionDate: entry.transactionDate?.slice(0, 10) || todayInputValue(),
    divisionId: entry.divisionId ? String(entry.divisionId) : "",
    departmentId: entry.departmentId ? String(entry.departmentId) : "",
    description: entry.description || "",
    details: entry.details.length > 0 ? entry.details.map(makeRow) : [makeRow()],
  };
}

function parseMoney(value: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.round(parsed * 100) / 100;
}

function money(value: number | null | undefined) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value ?? 0);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(date);
}

function statusBadgeClass(status: string) {
  if (status === "Posted") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700";
  if (status === "Voided") return "border-zinc-500/30 bg-zinc-500/10 text-zinc-700";
  return "border-amber-500/30 bg-amber-500/10 text-amber-700";
}

function toPayload(form: EntryForm): AdjustingEntryPayload {
  return {
    transactionDate: form.transactionDate,
    description: form.description.trim(),
    divisionId: form.divisionId ? Number(form.divisionId) : null,
    departmentId: form.departmentId ? Number(form.departmentId) : null,
    details: form.details.map((row) => ({
      coaId: Number(row.coaId),
      debit: parseMoney(row.debit),
      credit: parseMoney(row.credit),
    })),
  };
}

function validateForm(form: EntryForm) {
  if (!form.transactionDate) return "Transaction date is required";
  if (!form.description.trim()) return "Description is required";
  if (form.details.length === 0) return "At least one detail line is required";

  for (let index = 0; index < form.details.length; index += 1) {
    const row = form.details[index];
    const lineNumber = index + 1;
    const debit = parseMoney(row.debit);
    const credit = parseMoney(row.credit);

    if (!row.coaId) return `Line ${lineNumber}: chart of account is required`;
    if (debit < 0 || credit < 0) return `Line ${lineNumber}: amounts cannot be negative`;
    if (debit > 0 && credit > 0) return `Line ${lineNumber}: use either debit or credit`;
    if (debit === 0 && credit === 0) return `Line ${lineNumber}: enter a debit or credit amount`;
  }

  return null;
}

export function AdjustingJournalEntriesModule() {
  const [entries, setEntries] = React.useState<AdjustingEntry[]>([]);
  const [pageData, setPageData] = React.useState<Pick<AdjustingEntryPage, "number" | "size" | "totalElements" | "totalPages">>({
    number: 0,
    size: 10,
    totalElements: 0,
    totalPages: 0,
  });
  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState("All");
  const [page, setPage] = React.useState(0);
  const [pageSize, setPageSize] = React.useState(10);
  const [isLoading, setIsLoading] = React.useState(false);
  const [actionId, setActionId] = React.useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [readOnly, setReadOnly] = React.useState(false);
  const [editingEntry, setEditingEntry] = React.useState<AdjustingEntry | null>(null);
  const [form, setForm] = React.useState<EntryForm>(() => emptyForm());
  const [saving, setSaving] = React.useState(false);
  const [coaOptions, setCoaOptions] = React.useState<LookupOption[]>([]);
  const [divisions, setDivisions] = React.useState<DivisionLookup[]>([]);
  const [departments, setDepartments] = React.useState<DepartmentLookup[]>([]);

  const loadEntries = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await adjustingJournalEntriesApi.list({
        page,
        pageSize,
        search,
        status,
      });
      setEntries(data.content ?? []);
      setPageData({
        number: data.number ?? page,
        size: data.size ?? pageSize,
        totalElements: data.totalElements ?? 0,
        totalPages: data.totalPages ?? 0,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load adjusting entries");
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, search, status]);

  React.useEffect(() => {
    void loadEntries();
  }, [loadEntries]);

  React.useEffect(() => {
    let mounted = true;
    Promise.all([fetchCoaOptions(), fetchDivisionOptions(), fetchDepartmentOptions()])
      .then(([coa, divisionRows, departmentRows]) => {
        if (!mounted) return;
        setCoaOptions(coa);
        setDivisions(divisionRows);
        setDepartments(departmentRows);
      })
      .catch((error) => {
        toast.error(error instanceof Error ? error.message : "Failed to load lookup data");
      });

    return () => {
      mounted = false;
    };
  }, []);

  const totals = React.useMemo(() => {
    const totalDebit = form.details.reduce((sum, row) => sum + parseMoney(row.debit), 0);
    const totalCredit = form.details.reduce((sum, row) => sum + parseMoney(row.credit), 0);
    return {
      totalDebit: Math.round(totalDebit * 100) / 100,
      totalCredit: Math.round(totalCredit * 100) / 100,
      variance: Math.round((totalDebit - totalCredit) * 100) / 100,
    };
  }, [form.details]);

  const filteredDepartments = React.useMemo(() => {
    if (!form.divisionId) return departments;
    const divisionId = Number(form.divisionId);
    return departments.filter((department) => !department.parentDivision || department.parentDivision === divisionId);
  }, [departments, form.divisionId]);

  function openCreate() {
    setEditingEntry(null);
    setReadOnly(false);
    setForm(emptyForm());
    setDialogOpen(true);
  }

  function openEntry(entry: AdjustingEntry, viewOnly: boolean) {
    setEditingEntry(entry);
    setReadOnly(viewOnly || entry.status !== "Draft");
    setForm(formFromEntry(entry));
    setDialogOpen(true);
  }

  function updateForm<K extends keyof EntryForm>(key: K, value: EntryForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateRow(localId: string, field: keyof Pick<DetailFormRow, "coaId" | "debit" | "credit">, value: string) {
    setForm((current) => ({
      ...current,
      details: current.details.map((row) => {
        if (row.localId !== localId) return row;
        const next = { ...row, [field]: value };
        if (field === "debit" && parseMoney(value) > 0) next.credit = "";
        if (field === "credit" && parseMoney(value) > 0) next.debit = "";
        return next;
      }),
    }));
  }

  function removeRow(localId: string) {
    setForm((current) => ({
      ...current,
      details: current.details.filter((row) => row.localId !== localId),
    }));
  }

  async function saveDraft() {
    const validationError = validateForm(form);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setSaving(true);
    try {
      const payload = toPayload(form);
      if (editingEntry) {
        await adjustingJournalEntriesApi.update(editingEntry.id, payload);
        toast.success("Draft updated");
      } else {
        await adjustingJournalEntriesApi.create(payload);
        toast.success("Draft saved");
      }
      setDialogOpen(false);
      await loadEntries();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save draft");
    } finally {
      setSaving(false);
    }
  }

  async function runAction(entry: AdjustingEntry, action: "post" | "void" | "delete") {
    const confirmed = window.confirm(
      action === "post"
        ? `Post ${entry.jeNo || "this entry"}?`
        : action === "void"
          ? `Void ${entry.jeNo || "this entry"}?`
          : `Delete ${entry.jeNo || "this draft"}?`,
    );
    if (!confirmed) return;

    if (action === "post" && Math.abs(entry.variance) >= 0.005) {
      toast.error("Cannot post an imbalanced entry");
      return;
    }

    setActionId(entry.id);
    try {
      if (action === "post") {
        await adjustingJournalEntriesApi.post(entry.id);
        toast.success("Entry posted");
      } else if (action === "void") {
        await adjustingJournalEntriesApi.void(entry.id);
        toast.success("Entry voided");
      } else {
        await adjustingJournalEntriesApi.delete(entry.id);
        toast.success("Draft deleted");
      }
      await loadEntries();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Action failed");
    } finally {
      setActionId(null);
    }
  }

  const canPrev = page > 0;
  const canNext = pageData.totalPages > 0 && page + 1 < pageData.totalPages;

  return (
    <div className="flex h-full min-h-0 flex-col bg-muted/10">
      <div className="border-b bg-background px-6 py-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Adjusting Journal Entries</h1>
            <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
              <span>{pageData.totalElements} records</span>
              <Separator orientation="vertical" className="h-4" />
              <span>Financial Statements</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => void loadEntries()} disabled={isLoading}>
              <RefreshCw className={cn("mr-2 size-4", isLoading && "animate-spin")} />
              Refresh
            </Button>
            <Button size="sm" onClick={openCreate}>
              <Plus className="mr-2 size-4" />
              New AJE
            </Button>
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-6">
        <div className="flex flex-col gap-3 rounded-md border bg-background p-3 shadow-sm md:flex-row md:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(0);
              }}
              placeholder="Search JE no, description, or creator"
              className="pl-9"
            />
          </div>
          <Select
            value={status}
            onValueChange={(value) => {
              setStatus(value);
              setPage(0);
            }}
          >
            <SelectTrigger className="w-full md:w-[180px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={String(pageSize)}
            onValueChange={(value) => {
              setPageSize(Number(value));
              setPage(0);
            }}
          >
            <SelectTrigger className="w-full md:w-[120px]">
              <SelectValue placeholder="Rows" />
            </SelectTrigger>
            <SelectContent>
              {pageSizes.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size} rows
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden rounded-md border bg-background shadow-sm">
          <div className="h-full overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-background">
                <TableRow>
                  <TableHead className="w-[130px]">JE No.</TableHead>
                  <TableHead className="w-[140px]">Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="w-[130px]">Status</TableHead>
                  <TableHead className="w-[180px]">Cost Center</TableHead>
                  <TableHead className="w-[130px] text-right">Debit</TableHead>
                  <TableHead className="w-[130px] text-right">Credit</TableHead>
                  <TableHead className="w-[120px] text-right">Variance</TableHead>
                  <TableHead className="w-[230px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="h-40 text-center text-muted-foreground">
                      <Loader2 className="mx-auto mb-2 size-5 animate-spin" />
                      Loading entries
                    </TableCell>
                  </TableRow>
                ) : entries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="h-40 text-center text-muted-foreground">
                      No adjusting entries found
                    </TableCell>
                  </TableRow>
                ) : (
                  entries.map((entry) => {
                    const actionBusy = actionId === entry.id;
                    return (
                      <TableRow key={entry.id}>
                        <TableCell className="font-mono text-xs font-medium">
                          {entry.jeNo || `AJE-${entry.id}`}
                        </TableCell>
                        <TableCell>{formatDate(entry.transactionDate)}</TableCell>
                        <TableCell>
                          <div className="max-w-[420px] truncate font-medium">{entry.description}</div>
                          <div className="text-xs text-muted-foreground">{entry.creatorName || "Unknown creator"}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={statusBadgeClass(entry.status)}>
                            {entry.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="truncate text-sm">{entry.divisionName || "-"}</div>
                          <div className="truncate text-xs text-muted-foreground">{entry.departmentName || "-"}</div>
                        </TableCell>
                        <TableCell className="text-right font-mono">{money(entry.totalDebit)}</TableCell>
                        <TableCell className="text-right font-mono">{money(entry.totalCredit)}</TableCell>
                        <TableCell className={cn("text-right font-mono", Math.abs(entry.variance) >= 0.005 && "text-destructive")}>
                          {money(entry.variance)}
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" className="size-8" onClick={() => openEntry(entry, true)}>
                              <Eye className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              onClick={() => openEntry(entry, false)}
                              disabled={entry.status !== "Draft"}
                            >
                              <Pencil className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              onClick={() => void runAction(entry, "post")}
                              disabled={entry.status !== "Draft" || actionBusy}
                            >
                              {actionBusy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              onClick={() => void runAction(entry, "void")}
                              disabled={entry.status !== "Posted" || actionBusy}
                            >
                              <Ban className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8 text-destructive hover:text-destructive"
                              onClick={() => void runAction(entry, "delete")}
                              disabled={entry.status !== "Draft" || actionBusy}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-md border bg-background px-3 py-2 text-sm shadow-sm md:flex-row md:items-center md:justify-between">
          <div className="text-muted-foreground">
            Page {pageData.totalPages === 0 ? 0 : page + 1} of {pageData.totalPages}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={!canPrev} onClick={() => setPage((current) => Math.max(0, current - 1))}>
              <ChevronLeft className="mr-1 size-4" />
              Previous
            </Button>
            <Button variant="outline" size="sm" disabled={!canNext} onClick={() => setPage((current) => current + 1)}>
              Next
              <ChevronRight className="ml-1 size-4" />
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="flex max-h-[92vh] !w-[96vw] !max-w-[1200px] flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>
              {readOnly ? "View Adjusting Entry" : editingEntry ? "Edit Draft AJE" : "New Adjusting Entry"}
            </DialogTitle>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            <div className="grid gap-4 md:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="transactionDate">Transaction Date</Label>
                <Input
                  id="transactionDate"
                  type="date"
                  value={form.transactionDate}
                  onChange={(event) => updateForm("transactionDate", event.target.value)}
                  disabled={readOnly}
                />
              </div>
              <div className="space-y-2">
                <Label>Division</Label>
                <Select
                  value={form.divisionId || "none"}
                  onValueChange={(value) => {
                    updateForm("divisionId", value === "none" ? "" : value);
                    updateForm("departmentId", "");
                  }}
                  disabled={readOnly}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select division" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {divisions.map((division) => (
                      <SelectItem key={division.id} value={String(division.id)}>
                        {division.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Department</Label>
                <Select
                  value={form.departmentId || "none"}
                  onValueChange={(value) => updateForm("departmentId", value === "none" ? "" : value)}
                  disabled={readOnly}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {filteredDepartments.map((department) => (
                      <SelectItem key={department.id} value={String(department.id)}>
                        {department.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <div className="flex h-9 items-center rounded-md border px-3">
                  <Badge variant="outline" className={statusBadgeClass(editingEntry?.status || "Draft")}>
                    {editingEntry?.status || "Draft"}
                  </Badge>
                </div>
              </div>
              <div className="space-y-2 md:col-span-4">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={form.description}
                  onChange={(event) => updateForm("description", event.target.value)}
                  disabled={readOnly}
                  rows={3}
                />
              </div>
            </div>

            <div className="mt-5 rounded-md border">
              <div className="flex items-center justify-between border-b px-3 py-2">
                <div className="font-medium">Details</div>
                {!readOnly && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setForm((current) => ({ ...current, details: [...current.details, makeRow()] }))}
                  >
                    <Plus className="mr-2 size-4" />
                    Add Row
                  </Button>
                )}
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[360px]">Chart of Account</TableHead>
                      <TableHead className="w-[170px] text-right">Debit</TableHead>
                      <TableHead className="w-[170px] text-right">Credit</TableHead>
                      <TableHead className="w-[64px] text-right"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {form.details.map((row) => (
                      <TableRow key={row.localId}>
                        <TableCell>
                          <SearchableSelect
                            options={coaOptions}
                            value={row.coaId}
                            onValueChange={(value) => updateRow(row.localId, "coaId", value)}
                            placeholder="Select account"
                            disabled={readOnly}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={row.debit}
                            onChange={(event) => updateRow(row.localId, "debit", event.target.value)}
                            className="text-right font-mono"
                            disabled={readOnly || parseMoney(row.credit) > 0}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={row.credit}
                            onChange={(event) => updateRow(row.localId, "credit", event.target.value)}
                            className="text-right font-mono"
                            disabled={readOnly || parseMoney(row.debit) > 0}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          {!readOnly && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8 text-muted-foreground"
                              onClick={() => removeRow(row.localId)}
                              disabled={form.details.length <= 1}
                            >
                              <X className="size-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="grid gap-3 border-t bg-muted/30 px-3 py-3 text-sm md:grid-cols-3">
                <div className="flex items-center justify-between rounded-md border bg-background px-3 py-2">
                  <span className="text-muted-foreground">Total Debits</span>
                  <span className="font-mono font-semibold">{money(totals.totalDebit)}</span>
                </div>
                <div className="flex items-center justify-between rounded-md border bg-background px-3 py-2">
                  <span className="text-muted-foreground">Total Credits</span>
                  <span className="font-mono font-semibold">{money(totals.totalCredit)}</span>
                </div>
                <div className="flex items-center justify-between rounded-md border bg-background px-3 py-2">
                  <span className="text-muted-foreground">Variance</span>
                  <span className={cn("font-mono font-semibold", Math.abs(totals.variance) >= 0.005 && "text-destructive")}>
                    {money(totals.variance)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Close
            </Button>
            {!readOnly && (
              <Button onClick={() => void saveDraft()} disabled={saving}>
                {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
                Save Draft
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
