import "server-only";

import { CompanyRequestError, groupedByKeyAndDate, listRows, type KeyedDateRow } from "./companyClient";
import { roundMoney } from "./directus";
import type { PeerFlow, RegistryCompany } from "../types";

/**
 * Reads one company's own tables and attributes each document to a group peer.
 *
 * Matching rule deliberately identical to `entity-worksheet/services/companyFigures.ts`: a sale
 * belongs to a peer when the invoice's `customer_code` equals the peer's company code, or when the
 * customer TIN equals the peer TIN *and* that TIN is long enough to be a real TIN (the registry
 * stores the placeholder "1" for most companies, which would otherwise match everything).
 *
 * The extra work here, which the kernel cannot do, is direction and month: the seller's
 * `customer_code` and the buyer's `supplier_name` ride along in the group-by, so one request per
 * collection answers "to whom, in which month, how much" instead of one request per peer.
 *
 * Reachability is measured by this module's own reads rather than a ping: a ping that answers says
 * nothing about whether the instance will let us read, and the kernel's health check parses the
 * plain-text `/server/ping` reply as JSON, so it reports healthy instances as unreachable.
 */

const MIN_TIN_DIGITS = 9;
const CANCELLED_SALES = ["Cancelled", "Void", "cancelled", "void"];

const SALES_SUMS: Record<string, "sum"> = {
  total_amount: "sum",
  vat_amount: "sum",
  ewt_amount: "sum",
};

const PURCHASE_SUMS: Record<string, "sum"> = {
  total_amount: "sum",
  vat_amount: "sum",
  withholding_tax_amount: "sum",
};

interface CustomerRow {
  customer_code?: string | null;
  customer_tin?: string | null;
  customer_name?: string | null;
}

/**
 * Group companies are recorded on each other's customer tables under their trading name, not their
 * group code: Men2 has no customer whose `customer_code` is "VTC", but it does have
 * "VERTEX TECHNOLOGIES CORPORATION". A one-word phrase ("Cafeteria", "Manufacturing", "ACE") is not
 * used as a key — it matches unrelated customers like "VINZ PIZZA MANUFACTURING".
 */
function namePhrase(companyName: string): string {
  const stripped = companyName
    .toUpperCase()
    .replace(/[.,]/g, " ")
    .replace(/\b(CORPORATION|CORP|COMPANY|CO|INC|INCORPORATED|HOLDINGS?|GROUP|PHILIPPINES?)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return stripped.split(" ").length >= 2 ? stripped : "";
}

export interface CompanyLedger {
  company: RegistryCompany;
  /** Invoices this company raised on a peer, per peer. */
  sales: PeerFlow[];
  /** Purchase orders this company recorded against a peer. */
  purchases: PeerFlow[];
  /** False when the buyer's supplier field cannot be filtered as text, so reciprocity is unverifiable. */
  purchaseLinkable: boolean;
  /** False when the tables the ledger needs could not be read, so nothing about this company is verifiable. */
  reachable: boolean;
  unreachableReason: string | null;
  notices: string[];
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function normaliseTin(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "");
}

function emptyFlow(peer: RegistryCompany): PeerFlow {
  return { peerCode: peer.code, peerName: peer.name, documents: 0, base: 0, vat: 0, withheld: 0, months: [] };
}

function addRow(flow: PeerFlow, row: KeyedDateRow, total: number, vat: number, withheld: number) {
  const month = row.date.slice(0, 7);
  const base = total - vat;
  let bucket = flow.months.find((entry) => entry.month === month);
  if (!bucket) {
    bucket = { month, documents: 0, base: 0, vat: 0, withheld: 0 };
    flow.months.push(bucket);
  }
  bucket.documents += row.count;
  bucket.base += base;
  bucket.vat += vat;
  bucket.withheld += withheld;
  flow.documents += row.count;
  flow.base += base;
  flow.vat += vat;
  flow.withheld += withheld;
}

function finalise(flow: PeerFlow) {
  flow.base = roundMoney(flow.base);
  flow.vat = roundMoney(flow.vat);
  flow.withheld = roundMoney(flow.withheld);
  flow.months.sort((left, right) => left.month.localeCompare(right.month));
  for (const month of flow.months) {
    month.base = roundMoney(month.base);
    month.vat = roundMoney(month.vat);
    month.withheld = roundMoney(month.withheld);
  }
}

/** Attributes a free-text `supplier_name` to a peer; the longest matching name or code wins. */
export function matchPeerByText(text: string, peers: RegistryCompany[]): RegistryCompany | null {
  const haystack = text.toLowerCase();
  let best: RegistryCompany | null = null;
  let bestLength = 0;
  for (const peer of peers) {
    for (const needle of [peer.name, peer.code]) {
      const value = needle.trim().toLowerCase();
      // A one-letter company code ("C" for Cafeteria) would match almost any supplier string.
      if (value.length < 2) continue;
      if (haystack.includes(value) && value.length > bestLength) {
        best = peer;
        bestLength = value.length;
      }
    }
  }
  return best;
}

async function loadSales(
  company: RegistryCompany,
  year: number,
  codeToPeer: Map<string, RegistryCompany>,
  notices: string[],
): Promise<{ flows: Map<string, PeerFlow>; ok: boolean; reason: string | null }> {
  const flows = new Map<string, PeerFlow>();
  const codes = [...codeToPeer.keys()];
  if (codes.length === 0) return { flows, ok: true, reason: null };

  const from = `${year}-01-01`;
  const to = `${year}-12-31`;
  const peerFilter = { customer_code: { _in: codes } };

  let rows: KeyedDateRow[];
  try {
    rows = await groupedByKeyAndDate(
      company.baseUrl,
      company.token,
      company.code,
      "sales_invoice",
      "customer_code",
      "invoice_date",
      SALES_SUMS,
      from,
      to,
      { _and: [peerFilter, { transaction_status: { _nin: CANCELLED_SALES } }] },
    );
  } catch (error) {
    if (!(error instanceof CompanyRequestError) || error.status !== 400) {
      notices.push(`${company.code}: its sales invoices could not be read (${message(error)}).`);
      return { flows, ok: false, reason: message(error) };
    }
    notices.push(`${company.code}: cancelled invoices could not be excluded from the intercompany sales.`);
    try {
      rows = await groupedByKeyAndDate(
        company.baseUrl,
        company.token,
        company.code,
        "sales_invoice",
        "customer_code",
        "invoice_date",
        SALES_SUMS,
        from,
        to,
        peerFilter,
      );
    } catch (retry) {
      notices.push(`${company.code}: its sales invoices could not be read (${message(retry)}).`);
      return { flows, ok: false, reason: message(retry) };
    }
  }

  for (const row of rows) {
    const peer = codeToPeer.get(row.key);
    if (!peer) continue;
    const flow = flows.get(peer.code) ?? emptyFlow(peer);
    addRow(flow, row, row.sums.total_amount ?? 0, row.sums.vat_amount ?? 0, row.sums.ewt_amount ?? 0);
    flows.set(peer.code, flow);
  }
  for (const flow of flows.values()) finalise(flow);
  return { flows, ok: true, reason: null };
}

async function loadPurchases(
  company: RegistryCompany,
  year: number,
  peers: RegistryCompany[],
  notices: string[],
): Promise<{ flows: Map<string, PeerFlow>; linkable: boolean; ok: boolean; reason: string | null }> {
  const flows = new Map<string, PeerFlow>();
  const needles = [
    ...new Set(
      peers
        .flatMap((peer) => [peer.name, peer.code])
        .map((needle) => needle.trim())
        .filter((needle) => needle.length >= 2),
    ),
  ];
  if (needles.length === 0) return { flows, linkable: true, ok: true, reason: null };

  let rows: KeyedDateRow[];
  try {
    rows = await groupedByKeyAndDate(
      company.baseUrl,
      company.token,
      company.code,
      "purchase_order",
      "supplier_name",
      "date",
      PURCHASE_SUMS,
      `${year}-01-01`,
      `${year}-12-31`,
      { _or: needles.map((needle) => ({ supplier_name: { _icontains: needle } })) },
    );
  } catch (error) {
    if (error instanceof CompanyRequestError && error.status === 400) {
      notices.push(
        `${company.code}: its purchase orders cannot be tied to a group company — the supplier field rejects a text filter (HTTP 400), so it holds supplier ids rather than names.`,
      );
      return { flows, linkable: false, ok: true, reason: null };
    }
    notices.push(`${company.code}: its purchase orders could not be read (${message(error)}).`);
    return { flows, linkable: false, ok: false, reason: message(error) };
  }

  for (const row of rows) {
    const peer = matchPeerByText(row.key, peers);
    if (!peer) continue;
    const flow = flows.get(peer.code) ?? emptyFlow(peer);
    addRow(flow, row, row.sums.total_amount ?? 0, row.sums.vat_amount ?? 0, row.sums.withholding_tax_amount ?? 0);
    flows.set(peer.code, flow);
  }
  for (const flow of flows.values()) finalise(flow);
  return { flows, linkable: true, ok: true, reason: null };
}

export async function loadCompanyLedger(
  company: RegistryCompany,
  year: number,
  peers: RegistryCompany[],
): Promise<CompanyLedger> {
  const notices: string[] = [];
  const codeToPeer = new Map<string, RegistryCompany>();

  const peerCodes = peers.map((peer) => peer.code).filter((code) => code.length > 0);
  const peerTins = peers.map((peer) => normaliseTin(peer.tin)).filter((tin) => tin.length >= MIN_TIN_DIGITS);
  const peersByPhrase = new Map<string, RegistryCompany>();
  for (const peer of peers) {
    const phrase = namePhrase(peer.name);
    if (phrase) peersByPhrase.set(phrase, peer);
  }

  const or: Record<string, unknown>[] = [];
  if (peerCodes.length > 0) or.push({ customer_code: { _in: peerCodes } });
  if (peerTins.length > 0) or.push({ customer_tin: { _in: peerTins } });
  for (const phrase of peersByPhrase.keys()) or.push({ customer_name: { _icontains: phrase } });

  let customerOk = false;
  let customerFailure: string | null = null;
  if (or.length > 0) {
    try {
      const customers = await listRows<CustomerRow>(company.baseUrl, company.token, company.code, "customer", {
        fields: ["customer_code", "customer_tin", "customer_name"],
        filter: { _or: or },
        limit: 500,
      });
      for (const row of customers) {
        const code = String(row.customer_code ?? "").trim();
        if (!code) continue;
        const tin = normaliseTin(row.customer_tin);
        const name = String(row.customer_name ?? "").toUpperCase();
        const owner =
          peers.find((peer) => peer.code === code) ??
          (tin.length >= MIN_TIN_DIGITS ? peers.find((peer) => normaliseTin(peer.tin) === tin) : undefined) ??
          [...peersByPhrase.entries()].find(([phrase]) => name.includes(phrase))?.[1];
        if (owner) codeToPeer.set(code, owner);
      }
      customerOk = true;
      if (codeToPeer.size === 0) {
        notices.push(
          `${company.code}: no customer record on this instance matches a group company by code, TIN or name, so its sales cannot be attributed to a peer.`,
        );
      }
    } catch (error) {
      customerFailure = message(error);
      notices.push(
        `${company.code}: its customer table could not be read, so none of its sales can be attributed to a peer (${customerFailure}).`,
      );
    }
  }

  const [sales, purchases] = await Promise.all([
    loadSales(company, year, codeToPeer, notices),
    loadPurchases(company, year, peers, notices),
  ]);

  // A company whose invoices could not be read cannot be shown as having no invoices, so it leaves
  // the matrix entirely instead of producing one-sided pairs.
  const reachable = (customerOk || purchases.ok) && sales.ok;
  return {
    company,
    sales: [...sales.flows.values()],
    purchases: [...purchases.flows.values()],
    purchaseLinkable: purchases.linkable,
    reachable,
    unreachableReason: reachable ? null : (sales.reason ?? customerFailure ?? purchases.reason ?? "No answer"),
    notices,
  };
}
