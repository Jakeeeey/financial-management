// src/modules/financial-management/treasury/bulk-approval/services/http.ts
import { NextResponse } from "next/server";

export function jsonResponse(body: unknown, init?: ResponseInit) {
  return NextResponse.json(body, init);
}

export function serverErrorResponse(error: unknown) {
  return jsonResponse(
    {
      error: "Server error",
      message: error instanceof Error ? error.message : "Unknown server error",
    },
    { status: 500 }
  );
}
