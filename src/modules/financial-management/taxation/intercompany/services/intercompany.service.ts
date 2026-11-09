import "server-only";

import { listRegistryCompanies } from "./registry";
import { loadCompanyLedger, type CompanyLedger } from "./ledger";
import type {
  IntercompanyMonthlyRow,
  IntercompanyPair,
  IntercompanyPayload,
  PairStatus,
  PeerFlow,
  RegistryCompany,
} from "../types";

/**
 * Builds the ledger for one tax year: every directed company pair, the selected company's
 * months, and an honest list of what the derivation could not see.
 */

/** Four instances at a time: enough to hide per-instance latency, few enough to stay polite. */
const CONCURRENCY = 4;

/** A peso of rounding is not a disagreement between two sides of the same transaction. */
const AMOUNT_TOLERANCE = 1;

export class IntercompanyLookupError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "IntercompanyLookupError";
    this.status = status;
  }
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, work: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (let index = next++; index < items.length; index = next++) {
      results[index] = await work(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

function pairStatus(sale: PeerFlow | undefined, reciprocal: PeerFlow | undefined, linkable: boolean): PairStatus {
  if (!sale) return "MISSING";
  if (!linkable) return "NOT_LINKABLE";
  if (!reciprocal) return "MISSING";
  return Math.abs(reciprocal.base - sale.base) <= AMOUNT_TOLERANCE ? "MATCHED" : "DIFFERENT";
}

function buildPairs(ledgers: Map<string, CompanyLedger>): IntercompanyPair[] {
  const pairs: IntercompanyPair[] = [];
  for (const [fromCode, seller] of ledgers) {
    for (const [toCode, buyer] of ledgers) {
      if (toCode === fromCode) continue;
      const sale = seller.sales.find((flow) => flow.peerCode === toCode);
      const reciprocal = buyer.purchases.find((flow) => flow.peerCode === fromCode);
      if (!sale && !reciprocal) continue;

      const status = pairStatus(sale, reciprocal, buyer.purchaseLinkable);
      pairs.push({
        fromCode,
        fromName: seller.company.name,
        toCode,
        toName: buyer.company.name,
        invoices: sale?.documents ?? 0,
        amount: sale?.base ?? 0,
        vat: sale?.vat ?? 0,
        withheld: sale?.withheld ?? 0,
        reciprocalInvoices: reciprocal?.documents ?? 0,
        reciprocalAmount: reciprocal ? reciprocal.base : null,
        reciprocalWithheld: reciprocal ? reciprocal.withheld : null,
        status,
        missingSide: status === "MISSING" ? (sale ? "BUYER" : "SELLER") : null,
      });
    }
  }

  pairs.sort(
    (left, right) =>
      right.amount - left.amount ||
      (right.reciprocalAmount ?? 0) - (left.reciprocalAmount ?? 0) ||
      left.fromCode.localeCompare(right.fromCode) ||
      left.toCode.localeCompare(right.toCode),
  );
  return pairs;
}

function monthlyRows(ledger: CompanyLedger | undefined): IntercompanyMonthlyRow[] {
  if (!ledger) return [];
  const rows: IntercompanyMonthlyRow[] = [];
  const collect = (flows: PeerFlow[], direction: IntercompanyMonthlyRow["direction"]) => {
    for (const flow of flows) {
      for (const month of flow.months) {
        rows.push({
          month: month.month,
          counterpartyCode: flow.peerCode,
          counterpartyName: flow.peerName,
          direction,
          documents: month.documents,
          amount: month.base,
          vat: month.vat,
          withheld: month.withheld,
        });
      }
    }
  };
  collect(ledger.sales, "SALE");
  collect(ledger.purchases, "PURCHASE");

  rows.sort(
    (left, right) =>
      left.month.localeCompare(right.month) ||
      left.counterpartyName.localeCompare(right.counterpartyName) ||
      left.direction.localeCompare(right.direction),
  );
  return rows;
}

function unreachableNotice(company: RegistryCompany, reason: string | null): string {
  return `${company.code} — ${company.name} could not be read (${reason ?? "no answer"}), so it is not in the matrix and its side of any pair is unverified.`;
}

export interface LedgerRequest {
  companyId?: number;
  year: number;
}

export async function loadIntercompanyLedger({ companyId, year }: LedgerRequest): Promise<IntercompanyPayload> {
  const registry = await listRegistryCompanies();
  if (companyId !== undefined && !registry.find((company) => company.companyId === companyId)) {
    throw new IntercompanyLookupError(`Company ${companyId} is not an active entry in the company registry.`, 404);
  }

  const notices: string[] = [];
  if (registry.length < 2) {
    notices.push(
      registry.length === 0
        ? "The company registry has no active company, so there is nothing to compare."
        : "The company registry has a single active company, so no pair exists to compare.",
    );
  }

  const ledgers = new Map<string, CompanyLedger>();
  if (registry.length > 1) {
    const loaded = await mapWithConcurrency(registry, CONCURRENCY, (company) =>
      loadCompanyLedger(
        company,
        year,
        registry.filter((peer) => peer.companyId !== company.companyId),
      ),
    );
    for (const ledger of loaded) ledgers.set(ledger.company.code, ledger);
  }

  const companies: RegistryCompany[] = [];
  for (const company of registry) {
    const ledger = ledgers.get(company.code);
    const isReachable = ledger ? ledger.reachable : true;
    companies.push({
      ...company,
      reachable: isReachable,
      unreachableReason: ledger?.unreachableReason ?? null,
    });
    if (ledger) notices.push(...ledger.notices);
    if (!isReachable) notices.push(unreachableNotice(company, ledger?.unreachableReason ?? null));
  }

  // Only reachable companies form pairs: an unreachable buyer can neither confirm nor deny.
  const linked = new Map([...ledgers].filter(([, ledger]) => ledger.reachable));
  const pairs = buildPairs(linked);

  let oneSided = 0;
  for (const ledger of linked.values()) {
    for (const sale of ledger.sales) {
      if (sale.documents > 0 && !linked.has(sale.peerCode)) {
        oneSided += 1;
        notices.push(
          `${ledger.company.code} invoiced ${sale.peerName} (${sale.documents} document(s), ${sale.base.toFixed(2)}), but that company is unreadable, so the pair is left out rather than shown one-sided.`,
        );
      }
    }
  }

  const selected = companyId !== undefined ? registry.find((company) => company.companyId === companyId) : undefined;
  const selectedLedger = selected ? ledgers.get(selected.code) : undefined;
  if (selected && selectedLedger && !selectedLedger.reachable) {
    notices.push(`${selected.code} is unreachable, so its monthly breakdown is empty for ${year}.`);
  }

  // "Nothing names a group company" is only true when nothing did. A one-sided document is a hit
  // whose counterparty could not answer.
  if (pairs.length === 0 && registry.length > 1 && oneSided === 0) {
    notices.push(
      `No invoice in ${year} names another group company as its customer, and no purchase order names one as its supplier.`,
    );
  }

  return { companies, pairs, oneSided, monthly: monthlyRows(selectedLedger), notices };
}
