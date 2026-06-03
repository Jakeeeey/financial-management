"use client";

import * as React from "react";
import {
  ArrowDownUp,
  Ban,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
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

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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

type EntryAction = "post" | "void" | "delete";
type SortKey = "id" | "jeNo" | "transactionDate" | "status";
type SortDirection = "asc" | "desc";
type PendingAction = {
  entry: AdjustingEntry;
  action: EntryAction;
};

const pageSizes = [10, 20, 50];
const statusOptions = ["All", "Draft", "Posted", "Voided"];
const balancedTolerance = 0.005;
const sortableColumns: Record<SortKey, { label: string; field: string }> = {
  id: { label: "Created", field: "id" },
  jeNo: { label: "JE No.", field: "jeNo" },
  transactionDate: { label: "Date", field: "transactionDate" },
  status: { label: "Status", field: "status" },
};

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

function actionLabel(action: EntryAction) {
  if (action === "post") return "Post";
  if (action === "void") return "Void";
  return "Delete";
}

function actionDescription(action: EntryAction) {
  if (action === "post") return "This will move the draft into the posted ledger and prevent future edits.";
  if (action === "void") return "This will void the posted adjusting entry while preserving the audit record.";
  return "This will permanently remove the draft adjusting entry.";
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

function validateDetailRow(row: DetailFormRow) {
  const debit = parseMoney(row.debit);
  const credit = parseMoney(row.credit);

  if (!row.coaId) return "Chart of account is required";
  if (debit < 0 || credit < 0) return "Amounts cannot be negative";
  if (debit > 0 && credit > 0) return "Use either debit or credit";
  if (debit === 0 && credit === 0) return "Enter a debit or credit amount";

  return null;
}

function validateForm(form: EntryForm) {
  if (!form.transactionDate) return "Transaction date is required";
  if (!form.description.trim()) return "Description is required";
  if (form.details.length === 0) return "At least one detail line is required";

  for (let index = 0; index < form.details.length; index += 1) {
    const rowError = validateDetailRow(form.details[index]);
    if (rowError) return `Line ${index + 1}: ${rowError}`;
  }

  return null;
}

type AjeSearchableSelectProps = {
  options: LookupOption[];
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
};

function AjeSearchableSelect({
  options,
  value,
  onValueChange,
  placeholder = "Select option",
  disabled = false,
  className,
}: AjeSearchableSelectProps) {
  const [open, setOpen] = React.useState(false);
  const selectedLabel = React.useMemo(
    () => options.find((option) => option.value === value)?.label,
    [options, value],
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between", !value && "text-muted-foreground", className)}
          disabled={disabled}
        >
          <span className="truncate">{selectedLabel || placeholder}</span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder={`Search ${placeholder.toLowerCase()}...`} />
          <CommandList
            className="max-h-72 overscroll-contain"
            onWheel={(event) => event.stopPropagation()}
            onTouchMove={(event) => event.stopPropagation()}
          >
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.label}
                  onSelect={() => {
                    onValueChange(option.value);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 size-4",
                      value === option.value ? "opacity-100" : "opacity-0",
                    )}
                  />
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

type TooltipIconButtonProps = {
  label: string;
  tooltip: string;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
  onClick: () => void;
};

function TooltipIconButton({
  label,
  tooltip,
  disabled = false,
  className,
  children,
  onClick,
}: TooltipIconButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={label}
            className={cn("size-8", className)}
            onClick={onClick}
            disabled={disabled}
          >
            {children}
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}

type SortableHeadProps = {
  column: SortKey;
  activeColumn: SortKey;
  direction: SortDirection;
  className?: string;
  children: React.ReactNode;
  onSort: (column: SortKey) => void;
};

function SortableHead({
  column,
  activeColumn,
  direction,
  className,
  children,
  onSort,
}: SortableHeadProps) {
  const isActive = activeColumn === column;
  return (
    <TableHead className={className}>
      <Button
        type="button"
        variant="ghost"
        className="-ml-2 h-8 w-full justify-start overflow-hidden px-1 text-[11px] font-medium xl:text-xs"
        onClick={() => onSort(column)}
      >
        <span className="truncate">{children}</span>
        <ArrowDownUp className={cn("ml-1 size-3", isActive ? "opacity-100" : "opacity-35")} />
        {isActive && <span className="sr-only">sorted {direction}</span>}
      </Button>
    </TableHead>
  );
}

export function AdjustingJournalEntriesModule() {
  const [entries, setEntries] = React.useState<AdjustingEntry[]>([]);
  const [summaryEntries, setSummaryEntries] = React.useState<AdjustingEntry[]>([]);
  const [pageData, setPageData] = React.useState<Pick<AdjustingEntryPage, "number" | "size" | "totalElements" | "totalPages">>({
    number: 0,
    size: 10,
    totalElements: 0,
    totalPages: 0,
  });
  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState("All");
  const [startDate, setStartDate] = React.useState("");
  const [endDate, setEndDate] = React.useState("");
  const [filterDivisionId, setFilterDivisionId] = React.useState("all");
  const [filterDepartmentId, setFilterDepartmentId] = React.useState("all");
  const [sortKey, setSortKey] = React.useState<SortKey>("id");
  const [sortDirection, setSortDirection] = React.useState<SortDirection>("desc");
  const [page, setPage] = React.useState(0);
  const [pageSize, setPageSize] = React.useState(10);
  const [isLoading, setIsLoading] = React.useState(false);
  const [actionId, setActionId] = React.useState<number | null>(null);
  const [pendingAction, setPendingAction] = React.useState<PendingAction | null>(null);
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
        startDate,
        endDate,
        divisionId: filterDivisionId === "all" ? null : Number(filterDivisionId),
        departmentId: filterDepartmentId === "all" ? null : Number(filterDepartmentId),
        sort: `${sortableColumns[sortKey].field},${sortDirection}`,
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
  }, [
    page,
    pageSize,
    search,
    status,
    startDate,
    endDate,
    filterDivisionId,
    filterDepartmentId,
    sortKey,
    sortDirection,
  ]);

  const loadSummaryEntries = React.useCallback(async () => {
    try {
      const data = await adjustingJournalEntriesApi.list({
        page: 0,
        pageSize: 1000,
        search,
        startDate,
        endDate,
        divisionId: filterDivisionId === "all" ? null : Number(filterDivisionId),
        departmentId: filterDepartmentId === "all" ? null : Number(filterDepartmentId),
        sort: "id,desc",
      });
      setSummaryEntries(data.content ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load adjusting entry summary");
    }
  }, [
    search,
    startDate,
    endDate,
    filterDivisionId,
    filterDepartmentId,
  ]);

  React.useEffect(() => {
    void loadEntries();
  }, [loadEntries]);

  React.useEffect(() => {
    void loadSummaryEntries();
  }, [loadSummaryEntries]);

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

  const divisionOptions = React.useMemo<LookupOption[]>(
    () => [
      { value: "none", label: "None" },
      ...divisions.map((division) => ({
        value: String(division.id),
        label: division.name,
      })),
    ],
    [divisions],
  );

  const departmentOptions = React.useMemo<LookupOption[]>(
    () => [
      { value: "none", label: "None" },
      ...filteredDepartments.map((department) => ({
        value: String(department.id),
        label: department.name,
      })),
    ],
    [filteredDepartments],
  );

  const filteredDepartmentsForFilters = React.useMemo(() => {
    if (filterDivisionId === "all") return departments;
    const divisionId = Number(filterDivisionId);
    return departments.filter((department) => !department.parentDivision || department.parentDivision === divisionId);
  }, [departments, filterDivisionId]);

  const filterDivisionOptions = React.useMemo<LookupOption[]>(
    () => [
      { value: "all", label: "All divisions" },
      ...divisions.map((division) => ({
        value: String(division.id),
        label: division.name,
      })),
    ],
    [divisions],
  );

  const filterDepartmentOptions = React.useMemo<LookupOption[]>(
    () => [
      { value: "all", label: "All departments" },
      ...filteredDepartmentsForFilters.map((department) => ({
        value: String(department.id),
        label: department.name,
      })),
    ],
    [filteredDepartmentsForFilters],
  );

  const pageSummary = React.useMemo(() => ({
    draft: summaryEntries.filter((entry) => entry.status === "Draft" && Math.abs(entry.variance) < balancedTolerance).length,
    posted: summaryEntries.filter((entry) => entry.status === "Posted").length,
    voided: summaryEntries.filter((entry) => entry.status === "Voided").length,
    imbalanced: summaryEntries.filter((entry) => entry.status === "Draft" && Math.abs(entry.variance) >= balancedTolerance).length,
  }), [summaryEntries]);
  const summaryRecordCount = summaryEntries.length;

  const lineErrors = React.useMemo(
    () => form.details.map((row) => validateDetailRow(row)),
    [form.details],
  );

  const hasLineErrors = lineErrors.some(Boolean);
  const isBalanced = Math.abs(totals.variance) < balancedTolerance;
  const canPostFromModal = Boolean(editingEntry && editingEntry.status === "Draft" && isBalanced && !hasLineErrors);
  const hasActiveFilters = Boolean(
    search.trim() ||
    status !== "All" ||
    startDate ||
    endDate ||
    filterDivisionId !== "all" ||
    filterDepartmentId !== "all",
  );

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

  function clearFilters() {
    setSearch("");
    setStatus("All");
    setStartDate("");
    setEndDate("");
    setFilterDivisionId("all");
    setFilterDepartmentId("all");
    setPage(0);
  }

  function toggleSort(nextKey: SortKey) {
    if (sortKey === nextKey) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(nextKey);
      setSortDirection(nextKey === "transactionDate" || nextKey === "id" ? "desc" : "asc");
    }
    setPage(0);
  }

  async function persistDraft(closeAfterSave: boolean) {
    const validationError = validateForm(form);
    if (validationError) {
      toast.error(validationError);
      return null;
    }

    setSaving(true);
    try {
      const payload = toPayload(form);
      let savedEntry: AdjustingEntry;
      if (editingEntry) {
        savedEntry = await adjustingJournalEntriesApi.update(editingEntry.id, payload);
        toast.success("Draft updated");
      } else {
        savedEntry = await adjustingJournalEntriesApi.create(payload);
        toast.success("Draft saved");
      }
      if (closeAfterSave) setDialogOpen(false);
      await loadEntries();
      await loadSummaryEntries();
      return savedEntry;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save draft");
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function saveDraft() {
    await persistDraft(true);
  }

  async function saveAndRequestPost() {
    if (!editingEntry) return;
    const savedEntry = await persistDraft(false);
    if (!savedEntry) return;
    if (Math.abs(savedEntry.variance) >= balancedTolerance) {
      toast.error("Cannot post an imbalanced entry");
      return;
    }
    setPendingAction({ entry: savedEntry, action: "post" });
  }

  function requestAction(entry: AdjustingEntry, action: EntryAction) {
    if (action === "post" && Math.abs(entry.variance) >= balancedTolerance) {
      toast.error("Cannot post an imbalanced entry");
      return;
    }
    setPendingAction({ entry, action });
  }

  async function runAction(entry: AdjustingEntry, action: EntryAction) {
    if (action === "post" && Math.abs(entry.variance) >= balancedTolerance) {
      toast.error("Cannot post an imbalanced entry");
      setPendingAction(null);
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
      setPendingAction(null);
      if (editingEntry?.id === entry.id && action === "post") setDialogOpen(false);
      await loadEntries();
      await loadSummaryEntries();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Action failed");
    } finally {
      setActionId(null);
    }
  }

  const canPrev = page > 0;
  const canNext = pageData.totalPages > 0 && page + 1 < pageData.totalPages;

  return (
    <div className="flex min-h-full flex-col bg-muted/10">
      <div className="border-b bg-background px-6 py-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Adjusting Journal Entries</h1>
            <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
              <span>{summaryRecordCount} records</span>
              <Separator orientation="vertical" className="h-4" />
              <span>Manual ledger adjustments for accruals, deferrals, and corrections</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void Promise.all([loadEntries(), loadSummaryEntries()])}
              disabled={isLoading}
            >
              <RefreshCw className={cn("mr-2 size-4", isLoading && "animate-spin")} />
              Refresh
            </Button>
            <Button size="sm" onClick={openCreate}>
              <Plus className="mr-2 size-4" />
              New Adjusting Entry
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4 p-6">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-md border bg-background px-3 py-2 shadow-sm">
            <div className="text-xs font-medium uppercase text-muted-foreground">Draft</div>
            <div className="mt-1 text-2xl font-semibold">{pageSummary.draft}</div>
          </div>
          <div className="rounded-md border bg-background px-3 py-2 shadow-sm">
            <div className="text-xs font-medium uppercase text-muted-foreground">Posted</div>
            <div className="mt-1 text-2xl font-semibold text-emerald-700">{pageSummary.posted}</div>
          </div>
          <div className="rounded-md border bg-background px-3 py-2 shadow-sm">
            <div className="text-xs font-medium uppercase text-muted-foreground">Voided</div>
            <div className="mt-1 text-2xl font-semibold text-zinc-700">{pageSummary.voided}</div>
          </div>
          <div className="rounded-md border bg-background px-3 py-2 shadow-sm">
            <div className="text-xs font-medium uppercase text-muted-foreground">Imbalanced Drafts</div>
            <div className={cn("mt-1 text-2xl font-semibold", pageSummary.imbalanced > 0 && "text-destructive")}>
              {pageSummary.imbalanced}
            </div>
          </div>
        </div>

        <div className="grid gap-3 rounded-md border bg-background p-3 shadow-sm lg:grid-cols-12">
          <div className="space-y-1.5 lg:col-span-4">
            <Label htmlFor="aje-search-filter" className="text-xs font-medium text-muted-foreground">Search</Label>
            <div className="relative min-w-0">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="aje-search-filter"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(0);
                }}
                placeholder="JE no, description, or creator"
                className="pl-9"
              />
            </div>
          </div>
          <div className="space-y-1.5 lg:col-span-2">
            <Label htmlFor="aje-start-date-filter" className="text-xs font-medium text-muted-foreground">Start Date</Label>
            <Input
              id="aje-start-date-filter"
              type="date"
              value={startDate}
              onChange={(event) => {
                setStartDate(event.target.value);
                setPage(0);
              }}
              aria-label="Start date"
            />
          </div>
          <div className="space-y-1.5 lg:col-span-2">
            <Label htmlFor="aje-end-date-filter" className="text-xs font-medium text-muted-foreground">End Date</Label>
            <Input
              id="aje-end-date-filter"
              type="date"
              value={endDate}
              onChange={(event) => {
                setEndDate(event.target.value);
                setPage(0);
              }}
              aria-label="End date"
            />
          </div>
          <div className="space-y-1.5 lg:col-span-2">
            <Label className="text-xs font-medium text-muted-foreground">Status</Label>
            <Select
              value={status}
              onValueChange={(value) => {
                setStatus(value);
                setPage(0);
              }}
            >
              <SelectTrigger className="w-full">
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
          </div>
          <div className="space-y-1.5 lg:col-span-2">
            <Label className="text-xs font-medium text-muted-foreground">Rows Per Page</Label>
            <Select
              value={String(pageSize)}
              onValueChange={(value) => {
                setPageSize(Number(value));
                setPage(0);
              }}
            >
              <SelectTrigger className="w-full">
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
          <div className="space-y-1.5 lg:col-span-3">
            <Label className="text-xs font-medium text-muted-foreground">Division</Label>
            <AjeSearchableSelect
              options={filterDivisionOptions}
              value={filterDivisionId}
              onValueChange={(value) => {
                setFilterDivisionId(value);
                setFilterDepartmentId("all");
                setPage(0);
              }}
              placeholder="All divisions"
            />
          </div>
          <div className="space-y-1.5 lg:col-span-3">
            <Label className="text-xs font-medium text-muted-foreground">Department</Label>
            <AjeSearchableSelect
              options={filterDepartmentOptions}
              value={filterDepartmentId}
              onValueChange={(value) => {
                setFilterDepartmentId(value);
                setPage(0);
              }}
              placeholder="All departments"
            />
          </div>
          <div className="flex items-end lg:col-span-2">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={clearFilters}
              disabled={!hasActiveFilters}
            >
              <X className="mr-2 size-4" />
              Clear Filters
            </Button>
          </div>
        </div>

        <div className="rounded-md border bg-background shadow-sm">
          <div className="w-full overflow-hidden">
            <Table className="table-fixed text-xs xl:text-sm">
              <TableHeader className="sticky top-0 z-10 bg-background">
                <TableRow>
                  <SortableHead
                    column="jeNo"
                    activeColumn={sortKey}
                    direction={sortDirection}
                    className="w-[9%]"
                    onSort={toggleSort}
                  >
                    JE No.
                  </SortableHead>
                  <SortableHead
                    column="transactionDate"
                    activeColumn={sortKey}
                    direction={sortDirection}
                    className="w-[10%]"
                    onSort={toggleSort}
                  >
                    Date
                  </SortableHead>
                  <TableHead className="w-[22%]">Description</TableHead>
                  <SortableHead
                    column="status"
                    activeColumn={sortKey}
                    direction={sortDirection}
                    className="w-[9%]"
                    onSort={toggleSort}
                  >
                    Status
                  </SortableHead>
                  <TableHead className="w-[13%]">Cost Center</TableHead>
                  <TableHead className="w-[9%] text-right">Debit</TableHead>
                  <TableHead className="w-[9%] text-right">Credit</TableHead>
                  <TableHead className="w-[9%] text-right">Variance</TableHead>
                  <TableHead className="w-[10%] text-right">Actions</TableHead>
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
                      <div className="flex flex-col items-center gap-3">
                        <span>No adjusting entries found</span>
                        <Button type="button" size="sm" onClick={openCreate}>
                          <Plus className="mr-2 size-4" />
                          New Adjusting Entry
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  entries.map((entry) => {
                    const actionBusy = actionId === entry.id;
                    const canPost = entry.status === "Draft" && Math.abs(entry.variance) < balancedTolerance;
                    const postTooltip = canPost
                      ? "Post to ledger"
                      : entry.status !== "Draft"
                        ? "Only draft entries can be posted"
                        : "Cannot post until debits equal credits";
                    return (
                      <TableRow key={entry.id}>
                        <TableCell className="whitespace-normal break-words font-mono text-xs font-medium">
                          {entry.jeNo || `AJE-${entry.id}`}
                        </TableCell>
                        <TableCell className="whitespace-normal text-xs">{formatDate(entry.transactionDate)}</TableCell>
                        <TableCell className="min-w-0 whitespace-normal">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="line-clamp-2 min-w-0 font-medium">{entry.description}</div>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-sm text-left">{entry.description}</TooltipContent>
                          </Tooltip>
                          <div className="truncate text-xs text-muted-foreground">{entry.creatorName || "Unknown creator"}</div>
                        </TableCell>
                        <TableCell className="whitespace-normal">
                          <Badge variant="outline" className={statusBadgeClass(entry.status)}>
                            {entry.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="min-w-0 whitespace-normal">
                          <div className="truncate text-sm">{entry.divisionName || "-"}</div>
                          <div className="truncate text-xs text-muted-foreground">{entry.departmentName || "-"}</div>
                        </TableCell>
                        <TableCell className="break-all text-right font-mono text-[11px] xl:text-xs">{money(entry.totalDebit)}</TableCell>
                        <TableCell className="break-all text-right font-mono text-[11px] xl:text-xs">{money(entry.totalCredit)}</TableCell>
                        <TableCell className={cn("break-all text-right font-mono text-[11px] xl:text-xs", Math.abs(entry.variance) >= 0.005 && "text-destructive")}>
                          {money(entry.variance)}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap justify-end gap-0.5">
                            <TooltipIconButton
                              label={`View ${entry.jeNo || "adjusting entry"}`}
                              tooltip="View entry"
                              className="size-7"
                              onClick={() => openEntry(entry, true)}
                            >
                              <Eye className="size-3.5" />
                            </TooltipIconButton>
                            <TooltipIconButton
                              label={`Edit ${entry.jeNo || "adjusting entry"}`}
                              tooltip={entry.status === "Draft" ? "Edit draft" : "Posted and voided entries are read-only"}
                              className="size-7"
                              onClick={() => openEntry(entry, false)}
                              disabled={entry.status !== "Draft"}
                            >
                              <Pencil className="size-3.5" />
                            </TooltipIconButton>
                            <TooltipIconButton
                              label={`Post ${entry.jeNo || "adjusting entry"}`}
                              tooltip={postTooltip}
                              className="size-7"
                              onClick={() => requestAction(entry, "post")}
                              disabled={!canPost || actionBusy}
                            >
                              {actionBusy ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
                            </TooltipIconButton>
                            <TooltipIconButton
                              label={`Void ${entry.jeNo || "adjusting entry"}`}
                              tooltip={entry.status === "Posted" ? "Void posted entry" : "Only posted entries can be voided"}
                              className="size-7"
                              onClick={() => requestAction(entry, "void")}
                              disabled={entry.status !== "Posted" || actionBusy}
                            >
                              <Ban className="size-3.5" />
                            </TooltipIconButton>
                            <TooltipIconButton
                              label={`Delete ${entry.jeNo || "adjusting entry"}`}
                              tooltip={entry.status === "Draft" ? "Delete draft" : "Only drafts can be deleted"}
                              className="size-7 text-destructive hover:text-destructive"
                              onClick={() => requestAction(entry, "delete")}
                              disabled={entry.status !== "Draft" || actionBusy}
                            >
                              <Trash2 className="size-3.5" />
                            </TooltipIconButton>
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
                <AjeSearchableSelect
                  options={divisionOptions}
                  value={form.divisionId || "none"}
                  onValueChange={(value) => {
                    updateForm("divisionId", value === "none" ? "" : value);
                    updateForm("departmentId", "");
                  }}
                  placeholder="Select division"
                  disabled={readOnly}
                />
              </div>
              <div className="space-y-2">
                <Label>Department</Label>
                <AjeSearchableSelect
                  options={departmentOptions}
                  value={form.departmentId || "none"}
                  onValueChange={(value) => updateForm("departmentId", value === "none" ? "" : value)}
                  placeholder="Select department"
                  disabled={readOnly}
                />
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
                <div className="flex items-center gap-2">
                  <div className="font-medium">Details</div>
                  <Badge
                    variant="outline"
                    className={isBalanced ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700" : "border-destructive/30 bg-destructive/10 text-destructive"}
                  >
                    {isBalanced ? "Balanced" : "Imbalanced"}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
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
                    {form.details.map((row, index) => {
                      const rowError = lineErrors[index];
                      const showRowError = !readOnly && Boolean(rowError) && Boolean(row.coaId || row.debit || row.credit);
                      return (
                      <TableRow key={row.localId}>
                        <TableCell>
                          <AjeSearchableSelect
                            options={coaOptions}
                            value={row.coaId}
                            onValueChange={(value) => updateRow(row.localId, "coaId", value)}
                            placeholder="Select account"
                            disabled={readOnly}
                          />
                          {showRowError && (
                            <div className="mt-1 text-xs text-destructive">{rowError}</div>
                          )}
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
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <div className="sticky bottom-0 z-10 grid gap-3 border-t bg-background/95 px-3 py-3 text-sm shadow-[0_-8px_16px_rgba(15,23,42,0.06)] backdrop-blur md:grid-cols-3">
                <div className="flex items-center justify-between rounded-md border bg-background px-3 py-2">
                  <span className="text-muted-foreground">Total Debits</span>
                  <span className="font-mono font-semibold">{money(totals.totalDebit)}</span>
                </div>
                <div className="flex items-center justify-between rounded-md border bg-background px-3 py-2">
                  <span className="text-muted-foreground">Total Credits</span>
                  <span className="font-mono font-semibold">{money(totals.totalCredit)}</span>
                </div>
                <div className="flex items-center justify-between rounded-md border bg-background px-3 py-2">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    Variance
                    <Badge
                      variant="outline"
                      className={isBalanced ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700" : "border-destructive/30 bg-destructive/10 text-destructive"}
                    >
                      {isBalanced ? "Ready" : "Hold"}
                    </Badge>
                  </span>
                  <span className={cn("font-mono font-semibold", Math.abs(totals.variance) >= balancedTolerance && "text-destructive")}>
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
              <>
                {editingEntry?.status === "Draft" && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void saveAndRequestPost()}
                    disabled={saving || !canPostFromModal}
                  >
                    {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Send className="mr-2 size-4" />}
                    Post Draft
                  </Button>
                )}
                <Button onClick={() => void saveDraft()} disabled={saving}>
                  {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
                  Save Draft
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(pendingAction)}
        onOpenChange={(open) => {
          if (!open) setPendingAction(null);
        }}
      >
        <AlertDialogContent>
          {pendingAction && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {actionLabel(pendingAction.action)} {pendingAction.entry.jeNo || "this adjusting entry"}?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {actionDescription(pendingAction.action)}
                </AlertDialogDescription>
              </AlertDialogHeader>

              <div className="grid gap-2 rounded-md border bg-muted/30 p-3 text-sm sm:grid-cols-2">
                <div>
                  <div className="text-xs uppercase text-muted-foreground">Status</div>
                  <div className="font-medium">{pendingAction.entry.status}</div>
                </div>
                <div>
                  <div className="text-xs uppercase text-muted-foreground">Variance</div>
                  <div className={cn("font-mono font-medium", Math.abs(pendingAction.entry.variance) >= balancedTolerance && "text-destructive")}>
                    {money(pendingAction.entry.variance)}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase text-muted-foreground">Total Debits</div>
                  <div className="font-mono font-medium">{money(pendingAction.entry.totalDebit)}</div>
                </div>
                <div>
                  <div className="text-xs uppercase text-muted-foreground">Total Credits</div>
                  <div className="font-mono font-medium">{money(pendingAction.entry.totalCredit)}</div>
                </div>
              </div>

              <AlertDialogFooter>
                <AlertDialogCancel disabled={actionId === pendingAction.entry.id}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  variant={pendingAction.action === "delete" ? "destructive" : "default"}
                  disabled={actionId === pendingAction.entry.id}
                  onClick={() => void runAction(pendingAction.entry, pendingAction.action)}
                >
                  {actionId === pendingAction.entry.id && <Loader2 className="mr-2 size-4 animate-spin" />}
                  {actionLabel(pendingAction.action)}
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
