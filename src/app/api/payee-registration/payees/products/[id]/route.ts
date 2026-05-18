import { NextRequest, NextResponse } from "next/server";

/**
 * DELETE /api/payee-registration/payees/products/[id]
 * Remove a product assignment from a payee
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: idStr } = await params;
    const assignmentId = parseInt(idStr);
    if (isNaN(assignmentId)) {
      return NextResponse.json({ success: false, error: "Invalid ID" }, { status: 400 });
    }

    const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

    const response = await fetch(`${API_BASE_URL}/items/product_per_supplier/${assignmentId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${process.env.DIRECTUS_STATIC_TOKEN}`,
      },
    });

    if (!response.ok) {
      throw new Error("Failed to remove product assignment");
    }

    return NextResponse.json({
      success: true,
      message: "Product removed successfully",
    });
  } catch (error) {
    console.error("Delete Product Assignment Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal Server Error",
      },
      { status: 500 },
    );
  }
}
