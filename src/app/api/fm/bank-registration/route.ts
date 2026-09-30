import { NextRequest, NextResponse } from "next/server";
import { fetchAllBanks, createBank } from "@/modules/financial-management/bank-registration/services/bank";
import { BankSchema } from "@/modules/financial-management/bank-registration/types/bank.schema";
import { ZodError } from "zod";

export async function GET() {
  try {
    const banks = await fetchAllBanks();
    return NextResponse.json({
      success: true,
      data: banks,
    });
  } catch (error) {
    console.error("GET /api/fm/bank-registration error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch banks",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = BankSchema.omit({ id: true }).parse(body);

    const newBank = await createBank(validatedData);

    return NextResponse.json(
      {
        success: true,
        data: newBank,
        message: "Bank created successfully",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/fm/bank-registration error:", error);

    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: "Validation failed",
          details: error.errors,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to create bank",
      },
      { status: 500 }
    );
  }
}
