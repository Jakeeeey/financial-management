import { updateBulkProductPriceChangeable } from "@/modules/financial-management/supplier-registration/services/products-per-suppliers";
import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/fm/supplier-registration/products-per-supplier/bulk-price-changeable
 * Bulk update price changeable for multiple product-supplier relationships
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { ids, price_changeable } = body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: "No product supplier IDs provided" },
        { status: 400 },
      );
    }

    await updateBulkProductPriceChangeable(ids, Boolean(price_changeable));

    return NextResponse.json(
      {
        success: true,
        message: `Successfully updated ${ids.length} products`,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Bulk update price changeable error:", error);
    return NextResponse.json(
      {
        error: "Failed to bulk update price changeable status",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
