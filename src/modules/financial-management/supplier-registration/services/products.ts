import { Product, ProductsResponse } from "../types/product.schema";

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

/**
 * Fetch all products
 */
export async function fetchAllProducts(): Promise<Product[]> {
  try {
    const response = await fetch(`${API_BASE}/products?limit=-1&fields=*`, {
      method: "GET",
      headers: getHeaders(),
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch products: ${response.statusText}`);
    }

    const result: ProductsResponse = await response.json();
    return result.data || [];
  } catch (error) {
    console.error("Error fetching products:", error);
    throw error;
  }
}

/**
 * Search products by name or code
 */
export async function searchProducts(query: string): Promise<Product[]> {
  try {
    const filter = {
      _or: [
        { product_name: { _contains: query } },
        { product_code: { _contains: query } },
      ],
    };

    const response = await fetch(
      `${API_BASE}/products?limit=-1&fields=*&filter=${encodeURIComponent(
        JSON.stringify(filter),
      )}`,
      {
        method: "GET",
        headers: getHeaders(),
        cache: "no-store",
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to search products: ${response.statusText}`);
    }

    const result: ProductsResponse = await response.json();
    return result.data || [];
  } catch (error) {
    console.error("Error searching products:", error);
    throw error;
  }
}

/**
 * Fetch product by ID
 */
export async function fetchProductById(id: number): Promise<Product> {
  try {
    const response = await fetch(`${API_BASE}/products/${id}?fields=*`, {
      method: "GET",
      headers: getHeaders(),
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch product: ${response.statusText}`);
    }

    const result = await response.json();
    return result.data;
  } catch (error) {
    console.error(`Error fetching product ${id}:`, error);
    throw error;
  }
}
