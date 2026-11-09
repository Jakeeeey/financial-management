import type { VatComputation } from "./types";

/**
 * Two derivations the page needs from `VatComputation` but the engine does not store.
 *
 * Kept client-safe (no `server-only`) because both the tiles and the quarterly table
 * read them, and components never fetch.
 */

const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

/** Credit the quarter leaves for the next one: what was carried in, less this quarter's net. */
export function carryOut(vat: VatComputation): number[] {
  return vat.carriedIn.map((carried, index) => Math.max(0, round(carried - vat.netVat[index])));
}

export function total(values: number[]): number {
  return round(values.reduce((sum, value) => sum + value, 0));
}
