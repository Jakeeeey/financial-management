import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

import { buildSpringSourceJournalPath, getSpringBaseUrl } from "../../_spring";
import { getJournalEntries } from "@/modules/financial-management/financial-statements/journal-entry/services/journal-entry.service";
import type { JournalEntry } from "@/modules/financial-management/financial-statements/journal-entry/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function mapRowsToSourceJournal(jeNo: string, rows: JournalEntry[]) {
  const first = rows[0];

  return {
    jeNo,
    jeGroupCounter: first.jeGroupCounter ?? null,
    sourceModule: first.sourceModule ?? null,
    transactionRef: first.transactionRef ?? null,
    transactionDate: first.transactionDate ?? null,
    description: first.description ?? null,
    status: first.status ?? null,
    division: first.division ?? null,
    divisionName: first.divisionName ?? null,
    department: first.department ?? null,
    departmentName: first.departmentName ?? null,
    creator: first.creator ?? null,
    details: rows.map((row) => ({
      coaId: row.coaId ?? null,
      accountNumber: row.accountNumber ?? null,
      accountTitle: row.accountTitle ?? null,
      debit: row.debit ?? 0,
      credit: row.credit ?? 0,
    })),
  };
}

async function fetchSpringSourceEndpoint(jeNo: string, token?: string) {
  if (!token) return null;

  const springRes = await fetch(`${getSpringBaseUrl()}${buildSpringSourceJournalPath(jeNo)}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!springRes.ok) return null;

  const text = await springRes.text();
  return new NextResponse(text || null, {
    status: springRes.status,
    headers: text ? { "Content-Type": springRes.headers.get("content-type") || "application/json" } : undefined,
  });
}

async function fetchSourceFromMasterLedger(jeNo: string, token?: string) {
  const entries = await getJournalEntries("2000-01-01", "2100-12-31", token);
  const rows = entries.filter((entry) => entry.jeNo === jeNo);

  if (rows.length === 0) {
    return NextResponse.json({ message: "Source journal entry not found" }, { status: 404 });
  }

  return NextResponse.json(mapRowsToSourceJournal(jeNo, rows));
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jeNo: string }> },
) {
  const { jeNo } = await params;
  const cookieStore = await cookies();
  const token = cookieStore.get("vos_access_token")?.value;

  try {
    const springSourceResponse = await fetchSpringSourceEndpoint(jeNo, token);
    if (springSourceResponse) return springSourceResponse;

    return await fetchSourceFromMasterLedger(jeNo, token);
  } catch (error) {
    return NextResponse.json(
      {
        message: "Failed to load source journal entry",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 502 },
    );
  }
}
