import { ExpenseFormValues, ExpenseItem, ExpenseLog } from "../types";

const BASE_URL = "/api/fm/treasury/expenses-v2/expense-creation-v2";

export async function fetchExpenses(): Promise<ExpenseItem[]> {
  const res = await fetch(`${BASE_URL}/expense`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error("Failed to fetch expenses");
  }
  const result = await res.json();
  return result.data || [];
}

export async function createSingleExpense(
  data: ExpenseFormValues,
  asSubmit: boolean = false
): Promise<ExpenseItem> {
  const payload = {
    ...data,
    status: asSubmit ? "Pending Approval" : "Draft",
  };

  const res = await fetch(`${BASE_URL}/expense`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "Create expense failed" }));
    throw new Error(err.message || "Failed to create expense");
  }

  const result = await res.json();
  return result.data;
}

export async function createBulkExpenses(
  items: ExpenseFormValues[],
  asSubmit: boolean = false
): Promise<ExpenseItem[]> {
  const payload = items.map((item) => ({
    ...item,
    status: asSubmit ? "Pending Approval" : "Draft",
  }));

  const res = await fetch(`${BASE_URL}/expense`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "Bulk create failed" }));
    throw new Error(err.message || "Failed to create bulk expenses");
  }

  const result = await res.json();
  return result.data || [];
}

export async function updateExpense(
  id: number,
  data: Partial<ExpenseFormValues>,
  logRemarks?: string
): Promise<ExpenseItem> {
  const res = await fetch(`${BASE_URL}/expense?id=${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...data,
      log_remarks: logRemarks,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "Update failed" }));
    throw new Error(err.message || "Failed to update expense");
  }

  const result = await res.json();
  return result.data;
}

export async function resubmitExpense(
  id: number,
  data: ExpenseFormValues,
  resubmitNotes: string
): Promise<ExpenseItem> {
  const payload = {
    ...data,
    status: "Pending Approval",
    current_approval_level: 1,
    is_resubmitted: 1,
    is_resubmit: true,
    log_remarks: resubmitNotes,
  };

  const res = await fetch(`${BASE_URL}/expense?id=${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "Resubmit failed" }));
    throw new Error(err.message || "Failed to resubmit expense");
  }

  const result = await res.json();
  return result.data;
}

export async function submitDraftExpense(id: number): Promise<ExpenseItem> {
  const res = await fetch(`${BASE_URL}/expense?id=${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      status: "Pending Approval",
      current_approval_level: 1,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "Submission failed" }));
    throw new Error(err.message || "Failed to submit draft expense");
  }

  const result = await res.json();
  return result.data;
}

export async function deleteExpense(id: number): Promise<void> {
  const res = await fetch(`${BASE_URL}/expense?id=${id}`, {
    method: "DELETE",
  });

  if (!res.ok) {
    throw new Error("Failed to delete expense");
  }
}

export async function fetchExpenseLogs(expenseId: number): Promise<ExpenseLog[]> {
  const res = await fetch(`${BASE_URL}/expense-logs?expense_id=${expenseId}`, { cache: "no-store" });
  if (!res.ok) {
    return [];
  }
  const result = await res.json();
  return result.data || [];
}
