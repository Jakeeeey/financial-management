import {
  ProductPerSupplier,
  ProductPerSupplierWithDetails,
  ProductsPerSupplierResponse,
  ProductPerSupplierResponse,
} from "../types/product-per-suppplier.schema";

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
 * Fetch all products for a specific supplier with product details
 */
export async function fetchSupplierProducts(
  supplierId: number,
): Promise<ProductPerSupplierWithDetails[]> {
  try {
    const filter = {
      supplier_id: { _eq: supplierId },
    };

    // Fetch products_per_supplier with product details joined
    const response = await fetch(
      `${API_BASE}/products_per_supplier?limit=-1&fields=id,supplier_id,product_id,discount_type,product_id.product_name,product_id.product_code&filter=${encodeURIComponent(
        JSON.stringify(filter),
      )}`,
      {
        method: "GET",
        headers: getHeaders(),
        cache: "no-store",
      },
    );

    if (!response.ok) {
      throw new Error(
        `Failed to fetch supplier products: ${response.statusText}`,
      );
    }

    const result = await response.json();

    // Transform nested product data to flat structure
    return (result.data || []).map((item: any) => ({
      id: item.id,
      supplier_id: item.supplier_id,
      product_id: item.product_id?.product_id || item.product_id,
      discount_type: item.discount_type,
      product_name: item.product_id?.product_name || "Unknown Product",
      product_code: item.product_id?.product_code || null,
    }));
  } catch (error) {
    console.error(`Error fetching products for supplier ${supplierId}:`, error);
    throw error;
  }
}

/**
 * Add product to supplier
 */
export async function addProductToSupplier(
  data: Omit<ProductPerSupplier, "id">,
): Promise<ProductPerSupplier> {
  try {
    const response = await fetch(`${API_BASE}/products_per_supplier`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        error.errors?.[0]?.message || "Failed to add product to supplier",
      );
    }

    const result: ProductPerSupplierResponse = await response.json();
    return result.data;
  } catch (error) {
    console.error("Error adding product to supplier:", error);
    throw error;
  }
}

/**
 * Update discount type for product-supplier relationship
 */
export async function updateProductDiscount(
  id: number,
  discountType: number | null,
): Promise<ProductPerSupplier> {
  try {
    const response = await fetch(`${API_BASE}/products_per_supplier/${id}`, {
      method: "PATCH",
      headers: getHeaders(),
      body: JSON.stringify({ discount_type: discountType }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        error.errors?.[0]?.message || "Failed to update discount type",
      );
    }

    const result: ProductPerSupplierResponse = await response.json();
    return result.data;
  } catch (error) {
    console.error(`Error updating discount for product ${id}:`, error);
    throw error;
  }
}

/**
 * Remove product from supplier
 */
export async function removeProductFromSupplier(id: number): Promise<void> {
  try {
    const response = await fetch(`${API_BASE}/products_per_supplier/${id}`, {
      method: "DELETE",
      headers: getHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        error.errors?.[0]?.message || "Failed to remove product from supplier",
      );
    }
  } catch (error) {
    console.error(`Error removing product ${id} from supplier:`, error);
    throw error;
  }
}

/**
 * Check if product already exists for supplier
 */
export async function isProductAlreadyAdded(
  supplierId: number,
  productId: number,
): Promise<boolean> {
  try {
    const filter = {
      _and: [
        { supplier_id: { _eq: supplierId } },
        { product_id: { _eq: productId } },
      ],
    };

    const response = await fetch(
      `${API_BASE}/products_per_supplier?limit=1&fields=id&filter=${encodeURIComponent(
        JSON.stringify(filter),
      )}`,
      {
        method: "GET",
        headers: getHeaders(),
        cache: "no-store",
      },
    );

    if (!response.ok) {
      throw new Error("Failed to check product existence");
    }

    const result: ProductsPerSupplierResponse = await response.json();
    return (result.data || []).length > 0;
  } catch (error) {
    console.error("Error checking product existence:", error);
    throw error;
  }
}
