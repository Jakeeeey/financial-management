import {
  ChartOfAccountOption,
  DepartmentOption,
  DivisionOption,
  SupplierOption,
  ExpenseApproverOption,
  UserDefaultsOption,
} from "../types";

const BASE_URL = "/api/fm/treasury/expenses-v2/expense-creation-v2";

export async function fetchUserDefaults(): Promise<UserDefaultsOption | null> {
  try {
    const res = await fetch(`${BASE_URL}/user-defaults`, { cache: "no-store" });
    if (!res.ok) return null;
    const json = await res.json();
    return json.data || null;
  } catch {
    return null;
  }
}

export async function fetchDivisions(): Promise<DivisionOption[]> {
  try {
    const res = await fetch(`${BASE_URL}/division`, { cache: "no-store" });
    if (!res.ok) return [];
    const json = await res.json();
    return json.data || [];
  } catch {
    return [];
  }
}

export async function fetchDepartments(): Promise<DepartmentOption[]> {
  try {
    const res = await fetch(`${BASE_URL}/department`, { cache: "no-store" });
    if (!res.ok) return [];
    const json = await res.json();
    return json.data || [];
  } catch {
    return [];
  }
}

export async function fetchChartOfAccounts(expenseOnly: boolean = false): Promise<ChartOfAccountOption[]> {
  try {
    const url = expenseOnly
      ? `${BASE_URL}/chart_of_accounts?filter=expense_only`
      : `${BASE_URL}/chart_of_accounts`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return [];
    const json = await res.json();
    return json.data || [];
  } catch {
    return [];
  }
}

export async function fetchSuppliers(): Promise<SupplierOption[]> {
  try {
    const res = await fetch(`${BASE_URL}/suppliers`, { cache: "no-store" });
    if (!res.ok) return [];
    const json = await res.json();
    return json.data || [];
  } catch {
    return [];
  }
}

export async function fetchExpenseApprovers(): Promise<ExpenseApproverOption[]> {
  try {
    const res = await fetch("/api/fm/treasury/expenses-v2/expense-approval-v2/approvers", { cache: "no-store" });
    if (!res.ok) return [];
    const json = await res.json();
    return json.data || [];
  } catch {
    return [];
  }
}
