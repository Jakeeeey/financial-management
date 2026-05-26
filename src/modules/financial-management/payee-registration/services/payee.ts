import {
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

/**
 * Enforces Single Table Inheritance rules for Treasury payees.
 */
function normalizePayeePayload(data: Partial<Payee>): Partial<Payee> {
  const supplierType = data.supplier_type === "Trade" ? "Trade" : "Non-Trade";

  if (supplierType === "Trade") {
    return {
      ...data,
      supplier_type: "Trade",
      nonBuy: false,
    };
  }

  return {
    ...data,
    ...nonTradeNeutralFields,
    supplier_name: data.supplier_name,
    supplier_type: "Non-Trade",
    contact_person: data.contact_person || data.supplier_name || "",
    isActive: 1,
    nonBuy: true,
  };
}

/**
 * Fetch all payees (Non-Trade)
 */
export async function fetchAllPayees(): Promise<Payee[]> {
  try {
    const response = await fetch(
      `${API_BASE}/suppliers?limit=-1&fields=*&filter[supplier_type][_eq]=Non-Trade`,
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
    return result.data || [];
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
    return result.data;
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
    const payload = normalizePayeePayload(data);
    
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
    return result.data;
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
    const payload = normalizePayeePayload(data);
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
    return result.data;
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
        { supplier_type: { _eq: "Non-Trade" } },
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
    return result.data || [];
  } catch (error) {
    console.error("Error searching payees:", error);
    throw error;
  }
}
