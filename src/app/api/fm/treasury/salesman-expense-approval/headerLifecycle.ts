const ACTIVE_EXPENSE_STATUSES = new Set(["drafts", "with concern"]);
const TERMINAL_HEADER_STATUSES = new Set(["approved", "posted", "rejected"]);

function normalizeStatus(status: unknown): string {
  return String(status ?? "").trim().toLowerCase();
}

export function isActiveExpenseStatus(status: unknown): boolean {
  return ACTIVE_EXPENSE_STATUSES.has(normalizeStatus(status));
}

export function isTerminalHeaderStatus(status: unknown): boolean {
  return TERMINAL_HEADER_STATUSES.has(normalizeStatus(status));
}

export function deriveTerminalHeaderStatus(
  itemStatuses: unknown[]
): "Approved" | "Rejected" | null {
  if (itemStatuses.length === 0) return null;

  const normalized = itemStatuses.map(normalizeStatus);

  if (normalized.every((status) => status === "approved" || status === "posted")) {
    return "Approved";
  }

  if (normalized.every((status) => status === "rejected")) {
    return "Rejected";
  }

  return null;
}

export function isPendingHeader(
  headerStatus: unknown,
  itemStatuses: unknown[]
): boolean {
  return (
    !isTerminalHeaderStatus(headerStatus) &&
    itemStatuses.some(isActiveExpenseStatus)
  );
}

export type HeaderScope = "pending" | "history" | "all";

type HeaderLike = { id: number; status?: unknown };
type ExpenseLike = {
  header_id?: number | string | { id?: number | string | null } | null;
  status?: unknown;
};

function getHeaderId(value: ExpenseLike["header_id"]): number {
  if (typeof value === "object" && value !== null) {
    return Number(value.id) || 0;
  }

  return Number(value) || 0;
}

export function getEffectiveHeaderStatus(
  headerStatus: unknown,
  itemStatuses: unknown[]
): string {
  const currentStatus = String(headerStatus ?? "").trim();
  if (isTerminalHeaderStatus(currentStatus)) return currentStatus;

  return deriveTerminalHeaderStatus(itemStatuses) ?? currentStatus;
}

export function filterHeadersByScope<T extends HeaderLike>(
  headers: T[],
  expenses: ExpenseLike[],
  scope: HeaderScope
): T[] {
  return headers.filter((header) => {
    const itemStatuses = expenses
      .filter((expense) => getHeaderId(expense.header_id) === header.id)
      .map((expense) => expense.status);
    const pending = isPendingHeader(header.status, itemStatuses);
    const historical = isTerminalHeaderStatus(
      getEffectiveHeaderStatus(header.status, itemStatuses)
    );

    if (scope === "pending") return pending;
    if (scope === "history") return historical;
    return pending || historical;
  });
}
