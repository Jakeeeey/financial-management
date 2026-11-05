export interface VarianceCoaAccount {
  coaId: number | null;
  coaCode?: string | null;
  coaTitle?: string | null;
}

/** Names are display metadata only; internal IDs continue to identify variance rows. */
export function varianceCoaLabels(accounts: readonly VarianceCoaAccount[]): ReadonlyMap<number, string> {
  const byId = new Map<number, { code: string; title: string }>();
  for (const account of accounts) {
    if (account.coaId === null || !Number.isInteger(account.coaId) || account.coaId <= 0) continue;
    const current = byId.get(account.coaId);
    byId.set(account.coaId, {
      code: current?.code || account.coaCode?.trim() || "",
      title: current?.title || account.coaTitle?.trim() || "",
    });
  }
  return new Map(Array.from(byId, ([id, { code, title }]) => [id,
    title ? [code, title].filter(Boolean).join(" \u00b7 ") : `${code ? `${code} \u00b7 ` : ""}COA ${id} (name unavailable)`,
  ]));
}
