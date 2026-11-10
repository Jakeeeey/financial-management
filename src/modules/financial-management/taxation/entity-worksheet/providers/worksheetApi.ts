"use client";

import type { EntityProfile, EntitySnapshot, RegistryCompany } from "../types";

const BASE = "/api/fm/taxation/entity-worksheet";

interface Envelope<T> {
  success: boolean;
  data?: T;
  error?: string;
  fieldErrors?: Record<string, string[]>;
}

export class WorksheetApiError extends Error {
  fieldErrors?: Record<string, string[]>;

  constructor(message: string, fieldErrors?: Record<string, string[]>) {
    super(message);
    this.name = "WorksheetApiError";
    this.fieldErrors = fieldErrors;
  }
}

function unwrap<T>(payload: Envelope<T>): T {
  if (!payload.success || payload.data === undefined) {
    throw new WorksheetApiError(payload.error ?? "The request failed.", payload.fieldErrors);
  }
  return payload.data;
}

export interface WorksheetPayload {
  companies: RegistryCompany[];
  snapshot: EntitySnapshot;
}

export async function fetchWorksheet(companyId: number, year: number, fresh = false): Promise<WorksheetPayload> {
  const suffix = fresh ? "&refresh=1" : "";
  const response = await fetch(`${BASE}?companyId=${companyId}&year=${year}${suffix}`, { cache: "no-store" });
  const payload = (await response.json()) as Envelope<WorksheetPayload>;
  return unwrap(payload);
}

export async function saveProfile(profile: EntityProfile): Promise<EntityProfile> {
  const response = await fetch(BASE, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(profile),
  });

  const text = await response.text();
  let payload: (Envelope<EntityProfile> & { detail?: string }) | null = null;
  try {
    payload = JSON.parse(text) as Envelope<EntityProfile> & { detail?: string };
  } catch {
    payload = null;
  }

  if (!payload) {
    // A route-level failure (proxy, middleware, crash) never returns the envelope.
    throw new WorksheetApiError(
      response.ok
        ? "The profile could not be saved: the server returned an unreadable answer."
        : `The profile could not be saved (HTTP ${response.status}).`,
    );
  }

  return unwrap(payload);
}
