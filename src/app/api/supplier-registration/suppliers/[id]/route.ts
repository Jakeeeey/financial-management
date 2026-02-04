import { NextRequest, NextResponse } from "next/server";
import {
  fetchSupplierById,
  updateSupplier,
} from "@/modules/financial-management/supplier-registration/services/supplier";
import { SupplierFormSchema } from "@/modules/financial-management/supplier-registration/types/supplier.schema";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/suppliers/[id]
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: rawId } = await params; // Await the promise
    const id = parseInt(rawId);

    if (isNaN(id)) {
      return NextResponse.json(
        { success: false, error: "Invalid ID" },
        { status: 400 },
      );
    }

    const supplier = await fetchSupplierById(id);
    return NextResponse.json({ success: true, data: supplier });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/suppliers/[id]
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: rawId } = await params; // Await the promise
    const id = parseInt(rawId);

    if (isNaN(id))
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    const body = await request.json();
    const validatedData = SupplierFormSchema.partial().parse(body);
    const updatedSupplier = await updateSupplier(id, validatedData);

    return NextResponse.json({ success: true, data: updatedSupplier });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
