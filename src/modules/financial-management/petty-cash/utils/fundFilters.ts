export type FundFilterInput = {
  page: number;
  search?: string;
  departmentId?: number | null;
  custodianId?: number | null;
  status?: string | null;
};

export function fundFilterParams(input: FundFilterInput): URLSearchParams {
  const params = new URLSearchParams({ page: String(input.page), pageSize: "25" });

  const search = input.search?.trim();
  if (search) params.set("search", search);
  if (input.departmentId != null && input.departmentId > 0) params.set("departmentId", String(input.departmentId));
  if (input.custodianId != null && input.custodianId > 0) params.set("custodianId", String(input.custodianId));

  const status = input.status?.trim().toUpperCase();
  if (status && status !== "ALL") params.set("status", status);

  return params;
}
