export const sourcePaths: Record<string, string> = {
  Disbursement: "/fm/treasury/cash-issuance/ledger",
  "Sales Invoice": "/fm/accounting/sales-invoice-monitoring",
  Collection: "/fm/treasury/collection-posting/cashiering",
  "Adjusting Entry": "/fm/financial-statements/adjusting-journal-entries/summary",
};
export interface SourceDocument { type: string | null; id: number | null; reference: string | null; state: string; message: string | null }
export function sourceReferenceHref(source?: SourceDocument | null) {
  if (!source || source.state !== "RESOLVED" || !Number.isInteger(source.id) || !source.id || source.id < 1 || source.id > 2147483647 || !source.type || !Object.hasOwn(sourcePaths, source.type)) return null;
  return `${sourcePaths[source.type]}?${new URLSearchParams({ sourceId: String(source.id) })}`;
}
