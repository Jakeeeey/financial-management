import type { Bank, BankCreateInput } from "../types/bank.schema";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const API_BASE = `${API_BASE_URL}/items/bank_names`;

const getHeaders = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${process.env.DIRECTUS_STATIC_TOKEN}`,
});

export async function fetchAllBanks(): Promise<Bank[]> {
  const response = await fetch(`${API_BASE}?limit=-1&fields=*`, {
    method: "GET",
    headers: getHeaders(),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch banks: ${response.statusText}`);
  }

  const result = await response.json();
  return result.data || [];
}

export async function createBank(data: BankCreateInput): Promise<Bank> {
  const response = await fetch(API_BASE, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.errors?.[0]?.message || "Failed to create bank");
  }

  const result = await response.json();
  return result.data;
}

export async function updateBank(id: number, data: Partial<Bank>): Promise<Bank> {
  const response = await fetch(`${API_BASE}/${id}`, {
    method: "PATCH",
    headers: getHeaders(),
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.errors?.[0]?.message || "Failed to update bank");
  }

  const result = await response.json();
  return result.data;
}

export async function deleteBank(id: number): Promise<void> {
  const response = await fetch(`${API_BASE}/${id}`, {
    method: "DELETE",
    headers: getHeaders(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.errors?.[0]?.message || "Failed to delete bank");
  }
}
