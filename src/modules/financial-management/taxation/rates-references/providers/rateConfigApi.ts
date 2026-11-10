"use client";

import type { RateConfig, RateSettingRow, WithholdingRateRow } from "../types";

type Envelope = { success: boolean; data?: unknown; error?: string };

async function read(response: Response): Promise<Envelope> {
  const text = await response.text();
  try {
    return JSON.parse(text) as Envelope;
  } catch {
    return { success: false, error: `The desk answered with HTTP ${response.status} instead of JSON.` };
  }
}

export async function fetchRateConfig(companyId: number | null): Promise<RateConfig> {
  const query = companyId == null ? "" : `?companyId=${companyId}`;
  const envelope = await read(await fetch(`/api/fm/taxation/rates-references${query}`, { cache: "no-store" }));
  if (!envelope.success || !envelope.data) throw new Error(envelope.error ?? "The rates could not be read.");
  return envelope.data as RateConfig;
}

async function post(body: Record<string, unknown>): Promise<unknown> {
  const envelope = await read(
    await fetch("/api/fm/taxation/rates-references", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
  if (!envelope.success) throw new Error(envelope.error ?? "The rate could not be saved.");
  return envelope.data;
}

export async function saveRateSetting(companyId: number, row: RateSettingRow): Promise<RateSettingRow> {
  return (await post({ kind: "SETTINGS", companyId, ...row })) as RateSettingRow;
}

export async function saveWithholdingRate(companyId: number, row: WithholdingRateRow): Promise<WithholdingRateRow> {
  return (await post({ kind: "WITHHOLDING", companyId, ...row })) as WithholdingRateRow;
}
