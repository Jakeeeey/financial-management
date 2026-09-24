import {
  removeProductFromSupplier,
  updateProductDiscount,
  updateProductPriceChangeable,
} from "@/modules/financial-management/supplier-registration/services/products-per-suppliers";
import { NextRequest, NextResponse } from "next/server";

/**
 * PATCH /api/fm/supplier-registration/products-per-supplier/[id]
 * Update discount type or price changeable for a product-supplier relationship
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: paramId } = await params;
    const id = parseInt(paramId);

    if (isNaN(id)) {
      return NextResponse.json(
        { error: "Invalid product-supplier ID" },
        { status: 400 },
      );
    }

    const body = await request.json();
    let result;

    if ("price_changeable" in body) {
      result = await updateProductPriceChangeable(id, Boolean(body.price_changeable));
    } else {
      const { discount_type } = body;
      result = await updateProductDiscount(id, discount_type || null);
    }

    return NextResponse.json(
      {
        data: result,
        message: "Product supplier relationship updated successfully",
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error updating product supplier relationship:", error);
    return NextResponse.json(
      {
        error: "Failed to update product supplier relationship",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/fm/supplier-registration/products-per-supplier/[id]
 * Remove a product from a supplier
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: paramId } = await params;
    const id = parseInt(paramId);

    if (isNaN(id)) {
      return NextResponse.json(
        { error: "Invalid product-supplier ID" },
        { status: 400 },
      );
    }

    await removeProductFromSupplier(id);

    return NextResponse.json(
      {
        message: "Product removed from supplier successfully",
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error removing product from supplier:", error);
    return NextResponse.json(
      {
        error: "Failed to remove product from supplier",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
