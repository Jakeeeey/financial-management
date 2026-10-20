export interface ReviewCoaAccountRow {
  coa_id?: unknown;
  gl_code?: unknown;
  account_title?: unknown;
}

interface ReviewLineWithCoa {
  coaId: number | null;
}

interface ReviewBudgetLine extends ReviewLineWithCoa {
  coaCode?: string | null;
  coaTitle?: string | null;
}

export interface ReviewBudgetBalance {
  coaId: number;
  allocatedAmount: number;
}

export interface ReviewBudgetByCoa {
  coaId: number | null;
  coaCode: string | null;
  coaTitle: string | null;
  allocatedAmount: number | null;
}

function asText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function addCoaLabelsToLines<T extends ReviewLineWithCoa>(
  lines: T[],
  accounts: ReviewCoaAccountRow[],
): Array<T & { coaCode: string | null; coaTitle: string | null }> {
  const accountsById = new Map<number, { coaCode: string | null; coaTitle: string | null }>();
  for (const account of accounts) {
    const coaId = Number(account.coa_id);
    if (!Number.isInteger(coaId) || coaId <= 0) continue;
    accountsById.set(coaId, {
      coaCode: asText(account.gl_code),
      coaTitle: asText(account.account_title),
    });
  }

  return lines.map((line) => ({
    ...line,
    ...(accountsById.get(line.coaId ?? 0) ?? { coaCode: null, coaTitle: null }),
  }));
}

export function buildSubmissionBudgetByCoa(
  lines: ReviewBudgetLine[],
  balances: ReviewBudgetBalance[],
): ReviewBudgetByCoa[] {
  const categories = new Map<number | null, Omit<ReviewBudgetByCoa, "allocatedAmount">>();
  for (const line of lines) {
    const coaId = Number.isInteger(line.coaId) && Number(line.coaId) > 0 ? Number(line.coaId) : null;
    const current = categories.get(coaId);
    const coaCode = asText(line.coaCode);
    const coaTitle = asText(line.coaTitle);
    if (!current) {
      categories.set(coaId, { coaId, coaCode, coaTitle });
    } else {
      current.coaCode ??= coaCode;
      current.coaTitle ??= coaTitle;
    }
  }

  const allocatedByCoa = new Map(balances.map((balance) => [balance.coaId, balance.allocatedAmount]));
  return Array.from(categories.values()).map((category) => ({
    ...category,
    allocatedAmount: category.coaId === null ? null : allocatedByCoa.get(category.coaId) ?? 0,
  }));
}
