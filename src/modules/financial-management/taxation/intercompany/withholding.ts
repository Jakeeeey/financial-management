import {
  ASSUMED_WITHHOLDING_LABEL,
  ASSUMED_WITHHOLDING_TYPE,
  WITHHOLDING_RATES,
  type Tone,
} from "./constants";
import type { IntercompanyPair, WithholdingRow } from "./types";

/**
 * What the doc's rate would withhold on each pair, against what the ERP actually recorded.
 *
 * The rate is only defensible where the evidence says what kind of charge it is. A line
 * that came from a `sales_invoice` has no income type anywhere in the schema, so it is shown
 * as an assumed service fee and labelled as one. A line with no invoice behind it has no
 * basis at all and is reported as not determinable instead of borrowing a rate.
 */

const ASSUMED_RATE = WITHHOLDING_RATES[ASSUMED_WITHHOLDING_TYPE];
const ASSUMED_RATE_PERCENT = `${Math.round(ASSUMED_RATE * 100)}%`;

export const NOT_DETERMINABLE = "not determinable";
export const AMOUNT_TOLERANCE = 1;

/** How each verdict reads on screen, shared by the withholding tab and the pair drilldown. */
export const VERDICT_STYLE: Record<WithholdingRow["verdict"], { label: string; tone: Tone }> = {
  MATCHED: { label: "Within ₱1", tone: "success" },
  DIFFERENT: { label: "Differs", tone: "warning" },
  NOT_DETERMINABLE: { label: "Not determinable", tone: "info" },
};

function round(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function buildWithholdingRows(pairs: IntercompanyPair[]): WithholdingRow[] {
  return pairs.map((pair) => {
    const hasInvoice = pair.invoices > 0;
    const basis: WithholdingRow["basis"] = hasInvoice
      ? "SALES_INVOICE"
      : pair.reciprocalInvoices > 0
        ? "PURCHASE_ORDER"
        : "NONE";

    const rate = hasInvoice ? ASSUMED_RATE : null;
    const expected = hasInvoice ? round(pair.amount * ASSUMED_RATE) : null;

    // The payer's purchase order is the record of what was actually withheld; the seller's own
    // invoice field is the fallback when the buyer has no reachable record.
    const recordedSource: WithholdingRow["recordedSource"] =
      pair.reciprocalInvoices > 0
        ? "purchase_order"
        : hasInvoice
          ? "sales_invoice"
          : null;
    const recorded =
      recordedSource === "purchase_order"
        ? (pair.reciprocalWithheld ?? 0)
        : recordedSource === "sales_invoice"
          ? pair.withheld
          : null;

    const difference = expected !== null && recorded !== null ? round(recorded - expected) : null;
    const verdict: WithholdingRow["verdict"] =
      expected === null
        ? "NOT_DETERMINABLE"
        : difference !== null && Math.abs(difference) <= AMOUNT_TOLERANCE
          ? "MATCHED"
          : "DIFFERENT";

    return {
      fromCode: pair.fromCode,
      fromName: pair.fromName,
      toCode: pair.toCode,
      toName: pair.toName,
      basis,
      rate,
      rateLabel:
        rate === null
          ? NOT_DETERMINABLE
          : `${ASSUMED_RATE_PERCENT} ${ASSUMED_WITHHOLDING_LABEL}`,
      base: pair.amount,
      expected,
      recorded,
      recordedSource,
      difference,
      verdict,
      incomeType: rate === null ? null : ASSUMED_WITHHOLDING_TYPE,
    };
  });
}
