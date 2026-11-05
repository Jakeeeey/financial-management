export function journalEntryType(source: string): string {
  return ({ "Sales Invoice": "Sales", "Adjusting Entry": "Adjustment" } as Record<string, string>)[source] || source;
}
export const standardEntryTypes = ["Sales", "Collection", "Disbursement", "Adjustment"];
