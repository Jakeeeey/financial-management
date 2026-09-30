import { NextRequest, NextResponse } from "next/server";
import { updateBank, deleteBank } from "@/modules/financial-management/bank-registration/services/bank";
import { BankSchema } from "@/modules/financial-management/bank-registration/types/bank.schema";
import { ZodError } from "zod";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: rawId } = await params;
    const id = parseInt(rawId, 10);
    if (isNaN(id)) {
      return NextResponse.json(
        { success: false, error: "Invalid bank ID" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validatedData = BankSchema.partial().parse(body);

    const updatedBank = await updateBank(id, validatedData);

    return NextResponse.json({
      success: true,
      data: updatedBank,
      message: "Bank updated successfully",
    });
  } catch (error) {
    console.error(`PUT /api/fm/bank-registration/${params.id} error:`, error);

    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: "Validation failed",
          details: error,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to update bank",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: rawId } = await params;
    const id = parseInt(rawId, 10);
    if (isNaN(id)) {
      return NextResponse.json(
        { success: false, error: "Invalid bank ID" },
        { status: 400 }
      );
    }

    await deleteBank(id);

    return NextResponse.json({
      success: true,
      message: "Bank deleted successfully",
    });
  } catch (error) {
    console.error(`DELETE /api/fm/bank-registration/${params.id} error:`, error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to delete bank",
      },
      { status: 500 }
    );
  }
}
