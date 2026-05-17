import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/payee-registration/payees/[id]/products/bulk
 * Bulk assign products to a payee
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: idStr } = await params;
    const payeeId = parseInt(idStr);
    const { productIds } = await request.json();

    if (!payeeId || !Array.isArray(productIds)) {
      return NextResponse.json({ success: false, error: "Invalid data" }, { status: 400 });
    }

    const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
    
    // Create multiple records in the junction table
    const records = productIds.map(productId => ({
      supplier_id: payeeId,
      product_id: productId,
    }));

    const response = await fetch(`${API_BASE_URL}/items/product_per_supplier`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.DIRECTUS_STATIC_TOKEN}`,
      },
      body: JSON.stringify(records),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.errors?.[0]?.message || "Failed to assign products");
    }

    return NextResponse.json({
      success: true,
      message: `${productIds.length} products assigned successfully`,
    });
  } catch (error) {
    console.error("Bulk Product Assignment Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal Server Error",
      },
      { status: 500 },
    );
  }
}
