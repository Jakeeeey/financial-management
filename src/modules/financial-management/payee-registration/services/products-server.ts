/**
 * Server-side service for Payee Products
 * This should ONLY be used in API routes (server-side)
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const API_BASE = `${API_BASE_URL}/items`;

const getHeaders = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${process.env.DIRECTUS_STATIC_TOKEN}`,
});

/**
 * Fetch products assigned to a payee (Server-side)
 */
export async function fetchPayeeProductsServer(payeeId: number) {
  try {
    const fields = "id,supplier_id,product_id,discount_type,product_id.product_id,product_id.product_name,product_id.product_code,discount_type_id.name";
    
    // Using shorthand filter syntax to match fetchAllPayees
    const url = `${API_BASE}/product_per_supplier?limit=-1&fields=${fields}&filter[supplier_id][_eq]=${payeeId}`;

    const response = await fetch(url, {
      method: "GET",
      headers: getHeaders(),
      cache: "no-store",
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(`Directus error: ${response.status} ${JSON.stringify(errorBody)}`);
    }

    const result = await response.json();
    return result.data || [];
  } catch (error) {
    console.error(`Error in fetchPayeeProductsServer for payee ${payeeId}:`, error);
    throw error;
  }
}
