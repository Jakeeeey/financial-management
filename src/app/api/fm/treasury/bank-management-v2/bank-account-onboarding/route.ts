import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { COOKIE_NAME, decodeJwtPayload } from "@/lib/auth-utils";
import { ALL_OPTION, ONBOARDING_PAGE_SIZE } from "@/modules/financial-management/treasury/bank-management-v2/bank-account-onboarding/constants";
import { registerAccountBodySchema } from "@/modules/financial-management/treasury/bank-management-v2/bank-account-onboarding/schemas";
import { listAccounts } from "@/modules/financial-management/treasury/bank-management-v2/bank-account-onboarding/services/accounts.service";
import {
  createAccount,
  describeOnboardingError,
} from "@/modules/financial-management/treasury/bank-management-v2/bank-account-onboarding/services/onboarding.service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ListQuery = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
  bank: z.string().trim().max(160).optional(),
  accountType: z.string().trim().max(40).optional(),
  status: z.enum(["ACTIVE", "DORMANT", "CLOSED"]).optional(),
  currency: z.enum(["PHP", "USD"]).optional(),
  search: z.string().trim().max(120).optional(),
});

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const raw = Object.fromEntries(
    [...params.entries()].map(([key, value]) => [key, value.trim() === "" ? undefined : value]),
  );

  const parsed = ListQuery.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Invalid register filters.", fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  try {
    const data = await listAccounts({
      page: parsed.data.page ?? 1,
      pageSize: parsed.data.pageSize ?? ONBOARDING_PAGE_SIZE,
      bank: parsed.data.bank ?? ALL_OPTION,
      accountType: parsed.data.accountType ?? ALL_OPTION,
      status: parsed.data.status ?? ALL_OPTION,
      currency: parsed.data.currency ?? ALL_OPTION,
      search: parsed.data.search ?? "",
    });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    const failure = describeOnboardingError(error, "[bank-management-v2] onboarding register failed");
    return NextResponse.json(failure.body, { status: failure.status });
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Send a JSON body." }, { status: 400 });
  }

  const parsed = registerAccountBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Check the highlighted fields.", fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const createdBy = await currentUserId();
  if (!createdBy) {
    return NextResponse.json({ success: false, error: "Sign in again to register an account." }, { status: 401 });
  }

  try {
    const data = await createAccount(parsed.data, createdBy);
    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    const failure = describeOnboardingError(error, "[bank-management-v2] account onboarding failed");
    return NextResponse.json(failure.body, { status: failure.status });
  }
}

/** The signed-in user from the access-token cookie; `null` when the token carries no id. */
async function currentUserId(): Promise<number | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  const id = Number(token ? decodeJwtPayload(token)?.sub : NaN);
  return Number.isInteger(id) && id > 0 ? id : null;
}
