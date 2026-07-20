export type SummaryExpense = {
  encoded_by?: number | string | null;
  division_id?: number | string | null;
  header_id?: number | string | { id?: number | string | null } | null;
  status?: string | null;
  amount?: number | string | null;
};

export type CountBucket = {
  draft: number;
  rejected: number;
  concern: number;
  amount: number;
  headers: Set<number>;
  divisions: Set<number>;
};

function toFiniteNumber(value: unknown): number {
  const result = Number(value);
  return Number.isFinite(result) ? result : 0;
}

function getHeaderId(value: SummaryExpense["header_id"]): number {
  if (typeof value === "object" && value !== null) {
    return toFiniteNumber(value.id);
  }

  return toFiniteNumber(value);
}

export function aggregateExpensesByEmployee(
  expenses: SummaryExpense[]
): Record<string, CountBucket> {
  const buckets: Record<string, CountBucket> = {};

  for (const expense of expenses) {
    const encodedBy = toFiniteNumber(expense.encoded_by);
    if (encodedBy <= 0) continue;

    const key = String(encodedBy);
    const divisionId = toFiniteNumber(expense.division_id);

    if (!buckets[key]) {
      buckets[key] = {
        draft: 0,
        rejected: 0,
        concern: 0,
        amount: 0,
        headers: new Set<number>(),
        divisions: new Set<number>(),
      };
    }

    if (expense.status === "Drafts") {
      buckets[key].draft += 1;
    } else if (expense.status === "With Concern") {
      buckets[key].concern += 1;
    } else if (expense.status === "Rejected") {
      buckets[key].rejected += 1;
    }

    buckets[key].amount += toFiniteNumber(expense.amount);

    const headerId = getHeaderId(expense.header_id);
    if (headerId > 0) buckets[key].headers.add(headerId);
    if (divisionId > 0) buckets[key].divisions.add(divisionId);
  }

  return buckets;
}
