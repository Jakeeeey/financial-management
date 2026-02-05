import { NextRequest, NextResponse } from "next/server";
import { fetchAllProducts } from "@/modules/financial-management/supplier-registration/services/products";

export async function GET() {
  try {
    const products = await fetchAllProducts();

    return NextResponse.json({
      success: true,
      data: products,
      count: products.length,
    });
  } catch (error) {
    console.error("GET /api/fm/supplier-registration/products error:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to fetch products",
      },
      { status: 500 },
    );
  }
}
