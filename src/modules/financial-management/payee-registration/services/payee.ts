import type {
  Payee,
  PayeesResponse,
} from "../types/payee.schema";

/**
 * Base Directus API URL
 */
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const API_BASE = `${API_BASE_URL}/items`;

/**
 * Get headers with authentication token
 */
const getHeaders = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${process.env.DIRECTUS_STATIC_TOKEN}`,
});

const nonTradeNeutralFields = {
  supplier_shortcut: "",
  address: "",
  city: "",
  brgy: "",
  state_province: "",
  postal_code: "",
  country: "",
  payment_terms: "",
  delivery_terms: "",
  agreement_or_contract: "",
  preferred_communication_method: "",
  supplier_image: "",
};

function normalizeSupplierType(value: unknown): "TRADE" | "NON-TRADE" {
  const normalized = String(value ?? "NON-TRADE")
    .replace(/[-_\s]/g, "")
    .toUpperCase();

  return normalized === "TRADE" ? "TRADE" : "NON-TRADE";
}

/**
 * Enforces Single Table Inheritance rules for Treasury payees.
 */
function normalizeIsActive(value: unknown): 0 | 1 {
  if (value === true || value === 1 || value === "1") return 1;
  if (value === false || value === 0 || value === "0") return 0;
  throw new Error("Payee status must be Active (1) or Inactive (0).");
}

function normalizePayeePayload(
  data: Partial<Payee>,
  mode: "create" | "update",
): Partial<Payee> {
  const supplierType = normalizeSupplierType(data.supplier_type);
  const status = mode === "create"
    ? { isActive: 1 as const }
      : data.isActive === undefined
        ? {}
        : { isActive: normalizeIsActive(data.isActive) };

  if (mode === "update") {
    return {
      ...data,
      ...status,
      ...(data.supplier_type === undefined
        ? {}
        : { supplier_type: supplierType }),
    };
  }

  if (supplierType === "TRADE") {
    return {
      ...data,
      supplier_type: "TRADE",
      contact_person: data.contact_person || data.supplier_name || "",
      ...status,
      nonBuy: false,
    };
  }

  return {
    ...data,
    ...nonTradeNeutralFields,
    supplier_name: data.supplier_name,
    supplier_type: "NON-TRADE",
    contact_person: data.contact_person || data.supplier_name || "",
    ...status,
    nonBuy: true,
  };
}

function normalizePayeeRecord(data: Payee): Payee {
  return {
    ...data,
    isActive: data.isActive == null ? 1 : normalizeIsActive(data.isActive),
  };
}

/**
 * Fetch all payees (Non-Trade)
 */
export async function fetchAllPayees(): Promise<Payee[]> {
  try {
    const filter = encodeURIComponent(
      JSON.stringify({
        supplier_type: { _eq: "NON-TRADE" },
      }),
    );
    const response = await fetch(
      `${API_BASE}/suppliers?limit=-1&fields=*&filter=${filter}`,
      {
        method: "GET",
        headers: getHeaders(),
        cache: "no-store",
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch payees: ${response.statusText}`);
    }

    const result: PayeesResponse = await response.json();
    return (result.data || []).map(normalizePayeeRecord);
  } catch (error) {
    console.error("Error fetching payees:", error);
    throw error;
  }
}

/**
 * Fetch single payee by ID
 */
export async function fetchPayeeById(id: number): Promise<Payee> {
  try {
    const response = await fetch(`${API_BASE}/suppliers/${id}?fields=*`, {
      method: "GET",
      headers: getHeaders(),
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch payee: ${response.statusText}`);
    }

    const result = await response.json();
    return normalizePayeeRecord(result.data);
  } catch (error) {
    console.error(`Error fetching payee ${id}:`, error);
    throw error;
  }
}

/**
 * Create new payee
 */
export async function createPayee(
  data: Partial<Payee>,
): Promise<Payee> {
  try {
    const payload = normalizePayeePayload(data, "create");
    
    const response = await fetch(`${API_BASE}/suppliers`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        error.errors?.[0]?.message || "Failed to create payee",
      );
    }

    const result = await response.json();
    return normalizePayeeRecord(result.data);
  } catch (error) {
    console.error("Error creating payee:", error);
    throw error;
  }
}

/**
 * Update existing payee
 */
export async function updatePayee(
  id: number,
  data: Partial<Payee>,
): Promise<Payee> {
  try {
    const payload = normalizePayeePayload(data, "update");
    const response = await fetch(`${API_BASE}/suppliers/${id}`, {
      method: "PATCH",
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        error.errors?.[0]?.message || "Failed to update payee",
      );
    }

    const result = await response.json();
    return normalizePayeeRecord(result.data);
  } catch (error) {
    console.error(`Error updating payee ${id}:`, error);
    throw error;
  }
}

/**
 * Search payees by name, TIN, or contact person (strictly Non-Trade)
 */
export async function searchPayees(query: string): Promise<Payee[]> {
  try {
    const filter = {
      _and: [
        { supplier_type: { _eq: "NON-TRADE" } },
        {
          _or: [
            { supplier_name: { _contains: query } },
            { tin_number: { _contains: query } },
            { contact_person: { _contains: query } },
          ],
        },
      ],
    };

    const response = await fetch(
      `${API_BASE}/suppliers?limit=-1&fields=*&filter=${encodeURIComponent(
        JSON.stringify(filter),
      )}`,
      {
        method: "GET",
        headers: getHeaders(),
        cache: "no-store",
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to search payees: ${response.statusText}`);
    }

    const result: PayeesResponse = await response.json();
    return (result.data || []).map(normalizePayeeRecord);
  } catch (error) {
    console.error("Error searching payees:", error);
    throw error;
  }
}
