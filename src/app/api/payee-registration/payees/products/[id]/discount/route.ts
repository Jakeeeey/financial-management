import { NextRequest, NextResponse } from "next/server";

/**
 * PATCH /api/payee-registration/payees/products/[id]/discount
 * Update the discount type for a product assignment
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: idStr } = await params;
    const assignmentId = parseInt(idStr);
    const { discountTypeId } = await request.json();

    if (isNaN(assignmentId)) {
      return NextResponse.json({ success: false, error: "Invalid ID" }, { status: 400 });
    }

    const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

    const response = await fetch(`${API_BASE_URL}/items/product_per_supplier/${assignmentId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.DIRECTUS_STATIC_TOKEN}`,
      },
      body: JSON.stringify({
        discount_type_id: discountTypeId,
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to update discount");
    }

    return NextResponse.json({
      success: true,
      message: "Discount updated successfully",
    });
  } catch (error) {
    console.error("Update Discount Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal Server Error",
      },
      { status: 500 },
    );
  }
}
