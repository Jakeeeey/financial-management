import { NextRequest, NextResponse } from "next/server";
import { fetchPayeeProductsServer } from "@/modules/financial-management/payee-registration/services/products-server";

/**
 * GET /api/payee-registration/payees/[id]/products
 * Proxies the request to Directus via a server-side service
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: idStr } = await params;
  try {
    const id = parseInt(idStr);
    if (isNaN(id)) {
      return NextResponse.json({ success: false, error: "Invalid ID" }, { status: 400 });
    }

    const products = await fetchPayeeProductsServer(id);

    return NextResponse.json({
      success: true,
      data: products,
    });
  } catch (error) {
    console.error(`GET /api/payee-registration/payees/${idStr}/products error:`, error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal Server Error",
      },
      { status: 500 },
    );
  }
}
