/**
 * Payee Products Service
 * Handles the junction between payees and products
 */



/**
 * Fetch all products assigned to a specific payee
 */
export async function fetchPayeeProducts(payeeId: number) {
  try {
    const response = await fetch(
      `/api/payee-registration/payees/${payeeId}/products`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        cache: "no-store",
      },
    );

    if (!response.ok) {
      throw new Error("Failed to fetch payee products");
    }

    const result = await response.json();
    return result.data || [];
  } catch (error) {
    console.error("Error fetching payee products:", error);
    throw error;
  }
}

/**
 * Add products to a payee in bulk
 */
export async function addPayeeProductsBulk(payeeId: number, productIds: number[]) {
  try {
    const response = await fetch(`/api/payee-registration/payees/${payeeId}/products/bulk`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ productIds }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to add products");
    }

    return await response.json();
  } catch (error) {
    console.error("Error adding payee products:", error);
    throw error;
  }
}
