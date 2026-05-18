import { NextRequest, NextResponse } from "next/server";
import {
  fetchAllPayees,
  createPayee,
  searchPayees,
} from "@/modules/financial-management/payee-registration/services/payee";
import { PayeeFormSchema } from "@/modules/financial-management/payee-registration/types/payee.schema";

/**
 * GET /api/fm/payee-registration/payees
 * Fetch all payees (Non-Trade)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get("search");

    let payees;

    if (search && search.trim() !== "") {
      payees = await searchPayees(search.trim());
    } else {
      payees = await fetchAllPayees();
    }

    return NextResponse.json({
      success: true,
      data: payees,
      count: payees.length,
    });
  } catch (error) {
    console.error("GET /api/fm/payee-registration/payees error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch payees",
      },
      { status: 500 },
    );
  }
}

/**
 * POST /api/fm/payee-registration/payees
 * Create new payee
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate with Zod schema
    const validatedData = PayeeFormSchema.parse(body);

    const payeeWithMetadata = {
      ...validatedData,
      date_added: new Date().toISOString(),
      supplier_type: "Non-Trade", // Force non-trade type
    };

    // Create payee
    const newPayee = await createPayee(payeeWithMetadata);

    return NextResponse.json(
      {
        success: true,
        data: newPayee,
        message: "Payee created successfully",
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /api/fm/payee-registration/payees error:", error);

    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        {
          success: false,
          error: "Validation failed",
          details: error,
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to create payee",
      },
      { status: 500 },
    );
  }
}
