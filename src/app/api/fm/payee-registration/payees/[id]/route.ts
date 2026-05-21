import { NextRequest, NextResponse } from "next/server";
import {
  fetchPayeeById,
  updatePayee,
} from "@/modules/financial-management/payee-registration/services/payee";
import { PayeeFormSchema } from "@/modules/financial-management/payee-registration/types/payee.schema";

/**
 * GET /api/fm/payee-registration/payees/[id]
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

    const payee = await fetchPayeeById(id);
    return NextResponse.json({ success: true, data: payee });
  } catch (error) {
    console.error(`GET /api/fm/payee-registration/payees/${idStr} error:`, error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch payee",
      },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/fm/payee-registration/payees/[id]
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: idStr } = await params;
  try {
    const id = parseInt(idStr);
    if (isNaN(id)) {
      return NextResponse.json({ success: false, error: "Invalid ID" }, { status: 400 });
    }

    const body = await request.json();
    const validatedData = PayeeFormSchema.partial().parse(body);

    const updatedPayee = await updatePayee(id, validatedData);

    return NextResponse.json({
      success: true,
      data: updatedPayee,
      message: "Payee updated successfully",
    });
  } catch (error) {
    console.error(`PATCH /api/fm/payee-registration/payees/${idStr} error:`, error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to update payee",
      },
      { status: 500 },
    );
  }
}
