import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { FINANCIAL_PERFORMANCE_SOURCE_MODULES } from "@/modules/financial-management/financial-statements/statement-of-financial-performace/utils/report-coverage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const API_BASE_URL = `${process.env.SPRING_API_BASE_URL}/api`;

export async function GET(request: NextRequest) {
  const params = new URL(request.url).searchParams;
  const coaId = Number(params.get("coaId"));
  const startDate = params.get("startDate");
  const endDate = params.get("endDate");
  const divisionIsNull = params.get("accountDivisionIsNull");
  const departmentIsNull = params.get("accountDepartmentIsNull");

  if (!Number.isSafeInteger(coaId) || coaId <= 0 || !startDate || !endDate) {
    return NextResponse.json({ error: "A valid coaId, startDate, and endDate are required" }, { status: 400 });
  }
  if (!["true", "false"].includes(divisionIsNull ?? "") || !["true", "false"].includes(departmentIsNull ?? "")) {
    return NextResponse.json({ error: "Account division and department matching modes are required" }, { status: 400 });
  }
  if (divisionIsNull === "false" && !params.has("accountDivision")) {
    return NextResponse.json({ error: "accountDivision is required when it is not null" }, { status: 400 });
  }
  if (departmentIsNull === "false" && !params.has("accountDepartment")) {
    return NextResponse.json({ error: "accountDepartment is required when it is not null" }, { status: 400 });
  }

  const cookieStore = await cookies();
  const token = cookieStore.get("vos_access_token")?.value;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized: Missing vos_access_token" }, { status: 401 });
  }

  if (!params.has("sourceModule")) {
    for (const sourceModule of FINANCIAL_PERFORMANCE_SOURCE_MODULES) {
      params.append("sourceModule", sourceModule);
    }
  }

  const status = params.get("status");
  if (status?.toLowerCase() === "all") {
    params.delete("status");
  } else if (!status && params.get("postedOnly") !== "true") {
    params.set("status", "Posted");
  }

  try {
    const response = await fetch(`${API_BASE_URL}/income-statement/transactions?${params.toString()}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `Backend API responded with ${response.status}: ${errorText}` },
        { status: response.status }
      );
    }

    return NextResponse.json(await response.json());
  } catch (error) {
    console.error("[IncomeStatement Transactions API Route] Error:", error);
    return NextResponse.json({ error: "Failed to fetch account transactions" }, { status: 500 });
  }
}
