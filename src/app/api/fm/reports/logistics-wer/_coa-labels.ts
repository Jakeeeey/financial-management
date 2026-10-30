export interface CoaLabelRow {
  coa_id?: unknown;
  gl_code?: unknown;
  account_title?: unknown;
}

const text = (value: unknown): string | null => typeof value === "string" && value.trim() ? value.trim() : null;

/** Enrich display metadata only, retaining the input order and every financial field. */
export function addBudgetCoaLabels<T extends { coaId: number; coaCode?: string | null; coaTitle?: string | null }>(
  balances: readonly T[], accounts: readonly CoaLabelRow[],
): Array<T & { coaCode: string | null; coaTitle: string | null }> {
  const byId = new Map(accounts.map(account => [Number(account.coa_id), account]));
  return balances.map(balance => {
    const account = byId.get(balance.coaId);
    return { ...balance, coaCode: text(account?.gl_code) ?? text(balance.coaCode), coaTitle: text(account?.account_title) ?? text(balance.coaTitle) };
  });
}
