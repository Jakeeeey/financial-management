"use client";

import type { GroupOverviewData } from "../types";

const BASE = "/api/fm/taxation/group-overview";

interface Envelope<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export class GroupOverviewApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GroupOverviewApiError";
  }
}

function unwrap<T>(payload: Envelope<T>): T {
  if (!payload.success || payload.data === undefined) {
    throw new GroupOverviewApiError(payload.error ?? "The group overview request failed.");
  }
  return payload.data;
}

export async function fetchGroupOverview(year: number): Promise<GroupOverviewData> {
  const response = await fetch(`${BASE}?year=${year}`, { cache: "no-store" });
  const payload = (await response.json()) as Envelope<GroupOverviewData>;
  return unwrap(payload);
}
