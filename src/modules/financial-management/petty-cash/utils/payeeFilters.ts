export type PayeeFilterInput = {
  page: number;
  search?: string;
  payeeKind?: string | null;
  vatRegistered?: string | null;
  defaultExpense?: string | null;
};

export function payeeFilterParams(input: PayeeFilterInput): URLSearchParams {
  const params = new URLSearchParams({ page: String(input.page), pageSize: "25" });

  const search = input.search?.trim();
  if (search) params.set("search", search);

  const kind = input.payeeKind?.trim().toUpperCase();
  if (kind && kind !== "ALL") params.set("payeeKind", kind);

  const vat = input.vatRegistered?.trim().toLowerCase();
  if (vat === "true" || vat === "false") params.set("vatRegistered", vat);

  const expense = input.defaultExpense?.trim().toUpperCase();
  if (expense && expense !== "ALL") params.set("defaultExpense", expense);

  return params;
}
