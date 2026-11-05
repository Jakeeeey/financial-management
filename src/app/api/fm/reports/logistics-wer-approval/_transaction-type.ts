export const LOGISTICS_WER_TRANSACTION_TYPE = 2 as const;

function relationId(value: unknown): number | null {
  const raw = value && typeof value === "object"
    ? (value as Record<string, unknown>).id
    : value;
  const parsed = Number(raw);
  return Number.isInteger(parsed) ? parsed : null;
}

export function isValidLogisticsWerDisbursementHeader(header: {
  transaction_type?: unknown;
  doc_no?: unknown;
} | null | undefined): boolean {
  const docNo = typeof header?.doc_no === "string" ? header.doc_no.trim() : "";
  return relationId(header?.transaction_type) === LOGISTICS_WER_TRANSACTION_TYPE
    && /^NT-\d+$/i.test(docNo);
}
