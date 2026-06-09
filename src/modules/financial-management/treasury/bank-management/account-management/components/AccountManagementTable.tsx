import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { Pencil } from "lucide-react";
import type { AccountManagementPagination, BankAccount } from "../types";

type AccountManagementTableProps = {
  accounts: BankAccount[];
  pagination: AccountManagementPagination;
  page: number;
  totalPages: number;
  loading: boolean;
  saving: boolean;
  error?: string | null;
  onPageChange: (page: number) => void;
  onToggleActive: (account: BankAccount, checked: boolean) => void;
  onEditAccount: (account: BankAccount) => void;
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function formatDate(value: string) {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-PH", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(date);
}

export function AccountManagementTable({
  accounts,
  pagination,
  page,
  totalPages,
  loading,
  saving,
  error,
  onPageChange,
  onToggleActive,
  onEditAccount,
}: AccountManagementTableProps) {
  return (
    <CardContent className="p-0">
      {error ? (
        <div className="border-b px-4 py-3 text-sm text-destructive">{error}</div>
      ) : null}
      <div className="w-full overflow-hidden [&_[data-slot=table-container]]:!overflow-hidden">
        <Table className="w-full table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[14%]">Bank</TableHead>
              <TableHead className="w-[16%]">Registered Account</TableHead>
              <TableHead className="w-[10%]">Account No.</TableHead>
              <TableHead className="w-[14%]">Branch</TableHead>
              <TableHead className="w-[8%]">Routing</TableHead>
              <TableHead className="w-[10%] text-right">Balance</TableHead>
              <TableHead className="w-[18%]">Contact</TableHead>
              <TableHead className="w-10 px-1 text-center">Active</TableHead>
              <TableHead className="w-10 px-1 text-right">
                <span className="sr-only">Action</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9} className="h-28 text-center text-muted-foreground">
                  Loading bank accounts...
                </TableCell>
              </TableRow>
            ) : accounts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="h-28 text-center text-muted-foreground">
                  No bank accounts found.
                </TableCell>
              </TableRow>
            ) : accounts.map((account) => (
              <TableRow key={account.bankId}>
                <TableCell className="min-w-0 overflow-hidden align-top">
                  <div className="min-w-0">
                    <div className="truncate font-medium" title={account.bankName || "N/A"}>{account.bankName || "N/A"}</div>
                    <div className="mt-1 line-clamp-2 text-xs text-muted-foreground" title={account.bankDescription || "No description"}>
                      {account.bankDescription || "No description"}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="min-w-0 overflow-hidden align-top">
                  <div className="line-clamp-2" title={account.accountName || "N/A"}>{account.accountName || "N/A"}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {account.accountType || "No account type"}
                  </div>
                </TableCell>
                <TableCell className="min-w-0 overflow-hidden align-top font-mono text-sm">
                  <span className="block truncate" title={account.accountNumber || "N/A"}>{account.accountNumber || "N/A"}</span>
                </TableCell>
                <TableCell className="min-w-0 overflow-hidden align-top">
                  <div className="truncate" title={account.branch || "N/A"}>{account.branch || "N/A"}</div>
                  <div className="mt-1 line-clamp-2 text-xs text-muted-foreground" title={[account.city, account.province].filter(Boolean).join(", ") || "No location"}>
                    {[account.city, account.province].filter(Boolean).join(", ") || "No location"}
                  </div>
                </TableCell>
                <TableCell className="min-w-0 overflow-hidden align-top">
                  <span className="block truncate" title={account.ifscCode || "N/A"}>{account.ifscCode || "N/A"}</span>
                </TableCell>
                <TableCell className="min-w-0 overflow-hidden align-top text-right tabular-nums">
                  <span className="block truncate" title={formatMoney(account.openingBalance)}>
                    {formatMoney(account.openingBalance)}
                  </span>
                </TableCell>
                <TableCell className="min-w-0 overflow-hidden align-top">
                  <div className="truncate" title={account.contactPerson || "N/A"}>{account.contactPerson || "N/A"}</div>
                  <div className="mt-1 truncate text-xs text-muted-foreground" title={account.mobileNo || "No mobile"}>{account.mobileNo || "No mobile"}</div>
                  <div className="mt-1 truncate text-xs text-muted-foreground" title={account.email || "No email"}>{account.email || "No email"}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{formatDate(account.createdAt)}</div>
                </TableCell>
                <TableCell className="px-1 align-top text-center">
                  <Switch
                    checked={account.isActive}
                    disabled={saving}
                    size="sm"
                    onCheckedChange={(checked) => onToggleActive(account, checked)}
                    aria-label={`Toggle ${account.bankName} active status`}
                  />
                </TableCell>
                <TableCell className="px-1 align-top text-right">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={saving}
                    onClick={() => onEditAccount(account)}
                    aria-label={`Edit ${account.bankName} account`}
                  >
                    <Pencil />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="flex flex-col gap-3 border-t p-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {pagination.total === 0
            ? "0 accounts"
            : `${((pagination.page - 1) * pagination.pageSize) + 1}-${Math.min(pagination.page * pagination.pageSize, pagination.total)} of ${pagination.total} accounts`}
        </p>
        <Pagination className="mx-0 w-auto justify-end">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                aria-disabled={page <= 1 || saving}
                aria-label={page <= 1 ? "No previous page" : "Previous page"}
                className={cn((page <= 1 || saving) && "pointer-events-none opacity-50")}
                onClick={(event) => {
                  event.preventDefault();
                  if (!saving) onPageChange(Math.max(1, page - 1));
                }}
              />
            </PaginationItem>
            <PaginationItem>
              <span className="px-3 text-sm tabular-nums text-muted-foreground">
                {pagination.page} / {totalPages}
              </span>
            </PaginationItem>
            <PaginationItem>
              <PaginationNext
                aria-disabled={page >= totalPages || saving}
                aria-label={page >= totalPages ? "No next page" : "Next page"}
                className={cn((page >= totalPages || saving) && "pointer-events-none opacity-50")}
                onClick={(event) => {
                  event.preventDefault();
                  if (!saving) onPageChange(Math.min(totalPages, page + 1));
                }}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    </CardContent>
  );
}
