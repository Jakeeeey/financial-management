// src/modules/financial-management/claims-management/for-payment/utils/printTransmittalPaymentA4.ts
import { formatDateTime, formatPHP, toNumberSafe } from "./format";

type Header = {
    transmittal_no?: string | null;
    status?: string | null;
    supplier_name?: string | null;
    representative_name?: string | null;
    created_at?: string | null;
    created_by_name?: string | null;
    total_amount?: number | string | null;
};

type Line = {
    received_at?: string | null;
    memo_number?: string | null;
    customer_name?: string | null;
    gl_code?: string | null;
    account_title?: string | null;
    remarks?: string | null;
    reason?: string | null;
    amount?: number | string | null;
};

export type CompanyProfile = {
    company_id: number;
    company_name?: string | null;
    company_type?: string | null;
    company_code?: string | null;

    company_address?: string | null;
    company_brgy?: string | null;
    company_city?: string | null;
    company_province?: string | null;
    company_zipCode?: string | null;

    company_registrationNumber?: string | null;
    company_tin?: string | null;
    company_dateAdmitted?: string | null;

    company_contact?: string | null;
    company_email?: string | null;
    company_outlook?: string | null;
    company_gmail?: string | null;

    company_tags?: string | null;
    company_department?: string | null;

    company_logo?: string | null;
    company_facebook?: string | null;
    company_website?: string | null;
};

type Group = {
    key: string;
    label: string;
    rows: Line[];
    subtotal: number;
};

function esc(v: unknown): string {
    return String(v ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function safeText(v: unknown): string {
    return typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim();
}

function companyLineJoin(parts: Array<string | null | undefined>, sep = " • "): string {
    return parts.map((p) => safeText(p)).filter(Boolean).join(sep);
}

function coaLabelFor(r: Line): string {
    const title = safeText(r.account_title);
    const code = safeText(r.gl_code);
    if (title) return title;
    if (code) return code;
    return "—";
}

function coaKeyFor(r: Line): string {
    const code = safeText(r.gl_code);
    const title = safeText(r.account_title);
    return code || title || "—";
}

function groupByCOA(lines: Line[]): { groups: Group[]; grandTotal: number } {
    const map = new Map<string, Group>();

    for (const r of lines) {
        const key = coaKeyFor(r);
        const label = coaLabelFor(r);
        const amt = toNumberSafe(r.amount);

        const g = map.get(key);
        if (!g) {
            map.set(key, { key, label, rows: [r], subtotal: amt });
        } else {
            g.rows.push(r);
            g.subtotal += amt;
            if (g.label === "—" && label !== "—") g.label = label;
        }
    }

    const groups = Array.from(map.values()).sort((a, b) =>
        a.label.localeCompare(b.label, undefined, { sensitivity: "base" })
    );

    const grandTotal = groups.reduce((sum, g) => sum + g.subtotal, 0);
    return { groups, grandTotal };
}

export function printTransmittalPaymentA4(args: {
    header: Header;
    lines: Line[];
    company?: CompanyProfile | null;
}): void {
    const header = args.header ?? {};
    const lines = Array.isArray(args.lines) ? args.lines : [];
    const company = args.company ?? null;

    const transNo = safeText(header.transmittal_no) || "—";
    const status = safeText(header.status) || "FOR PAYMENT";

    const supplier = safeText(header.supplier_name) || "—";
    const rep = safeText(header.representative_name) || "—";

    const createdAt = header.created_at ? formatDateTime(header.created_at) : "—";
    const createdBy = safeText(header.created_by_name) || "—";

    const printedAt = formatDateTime(new Date().toISOString());

    const { groups, grandTotal } = groupByCOA(lines);
    const grandTotalDisplay = formatPHP(
        header.total_amount != null ? toNumberSafe(header.total_amount) : grandTotal
    );

    const companyName = safeText(company?.company_name) || "—";

    const companyAddress = companyLineJoin(
        [
            company?.company_address,
            company?.company_brgy,
            company?.company_city,
            company?.company_province,
            company?.company_zipCode,
        ],
        ", "
    );

    const companyLegal = companyLineJoin(
        [
            safeText(company?.company_tin) ? `TIN: ${safeText(company?.company_tin)}` : "",
            safeText(company?.company_registrationNumber)
                ? `Reg No: ${safeText(company?.company_registrationNumber)}`
                : "",
        ],
        " • "
    );

    const companyContact = companyLineJoin(
        [
            safeText(company?.company_contact) ? `Tel: ${safeText(company?.company_contact)}` : "",
            safeText(company?.company_email),

        ],
        " • "
    );

    const rowsHtml =
        groups.length === 0
            ? `<tr><td colspan="6" class="muted" style="text-align:center;padding:16px;">No CCM lines.</td></tr>`
            : groups
                .map((g) => {
                    const headerRow = `
<tr class="groupRow avoidBreak">
  <td colspan="6">
    <div class="groupTitle">${esc(g.label)}</div>
  </td>
</tr>`;

                    const itemRows = g.rows
                        .map((r) => {
                            const receivedAt = r.received_at ? formatDateTime(r.received_at) : "—";
                            const memoNo = safeText(r.memo_number) || "—";
                            const customer = safeText(r.customer_name) || "—";

                            const coa = coaLabelFor(r);
                            const remarks = safeText(r.remarks) || safeText(r.reason) || "—";
                            const total = formatPHP(toNumberSafe(r.amount));

                            return `
<tr class="avoidBreak">
  <td>${esc(coa)}</td>
  <td class="nowrap dateCell">${esc(receivedAt)}</td>
  <td class="mono">${esc(memoNo)}</td>
  <td>${esc(customer)}</td>
  <td>${esc(remarks)}</td>
  <td class="num nowrap">${esc(total)}</td>
</tr>`;
                        })
                        .join("");

                    const subtotalRow = `
<tr class="subRow avoidBreak">
  <td colspan="5" class="subLabel">Subtotal — ${esc(g.label)}</td>
  <td class="num subValue nowrap">${esc(formatPHP(g.subtotal))}</td>
</tr>`;

                    return headerRow + itemRows + subtotalRow;
                })
                .join("");

    const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Claims Transmittal - ${esc(transNo)}</title>
<style>
  @page { size: A4; margin: 12mm; }

  html, body { height: 100%; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    color: #111;
    font-size: 11px;
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  .page {
    width: 100%;
    max-width: 190mm;
    margin: 0 auto;
    min-height: calc(297mm - 24mm);
    display: flex;
    flex-direction: column;
  }
  .content { flex: 1 1 auto; }
  .footer { margin-top: auto; }

  .companyBar {
    display: grid;
    grid-template-columns: 1fr 52mm;
    gap: 10px;
    align-items: start;
    padding-bottom: 10px;
    border-bottom: 1px solid #ddd;
    margin-bottom: 10px;
  }
  .companyInfo .companyName {
    font-size: 14px;
    font-weight: 900;
    letter-spacing: .2px;
    line-height: 1.2;
  }
  .companyInfo .line { margin-top: 2px; color:#333; line-height: 1.25; }
  .companyInfo .muted { color:#666; }

  .docInfo { text-align:right; }
  .docTitle { font-size: 12px; font-weight: 900; letter-spacing: .2px; }
  .docSub { margin-top: 6px; color:#444; line-height: 1.25; }
  .pill {
    display: inline-block;
    border: 1px solid #bbb;
    padding: 3px 8px;
    border-radius: 999px;
    font-size: 10px;
    font-weight: 900;
    color: #222;
    white-space: nowrap;
    margin-top: 6px;
  }

  .meta {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px 16px;
    margin: 10px 0 12px;
  }
  .kv { border: 1px solid #eee; border-radius: 10px; padding: 8px 10px; background: #fff; }
  .kv .k { color: #666; font-size: 10px; }
  .kv .v { margin-top: 2px; font-weight: 800; }
  .mono {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  }
  .muted { color:#666; }

  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  thead { display: table-header-group; }

  thead th {
    text-align: left;
    font-size: 10px;
    color: #333;
    border-bottom: 1px solid #bbb;
    padding: 8px 8px;
    background: #fafafa;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  tbody td {
    border-bottom: 1px solid #eee;
    padding: 7px 8px;
    vertical-align: top;
    word-wrap: break-word;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  td.num {
    overflow: visible !important;
    text-overflow: clip !important;
    white-space: nowrap !important;
  }

  .num { text-align: right; font-variant-numeric: tabular-nums; }
  .nowrap { white-space: nowrap; }
  td.dateCell { font-size: 10px; }

  tr.groupRow td {
    background: #f4f4f5;
    border-top: 1px solid #ddd;
    border-bottom: 1px solid #ddd;
    padding-top: 8px;
    padding-bottom: 8px;
  }
  .groupTitle { font-weight: 900; }

  tr.subRow td {
    background: #fafafa;
    border-bottom: 1px solid #ddd;
    padding-top: 8px;
    padding-bottom: 8px;
  }
  .subLabel { text-align: right; color:#444; font-weight: 800; }
  .subValue { font-weight: 900; }

  .avoidBreak { break-inside: avoid; page-break-inside: avoid; }
  tr, td, th { break-inside: avoid; page-break-inside: avoid; }

  .footer {
    margin-top: 14px;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 18px;
    align-items: end;
  }
  .totals {
    justify-self: end;
    text-align: right;
    border-top: 1px solid #ddd;
    padding-top: 10px;
    min-width: 240px;
  }
  .totals .label { color: #666; font-size: 10px; }
  .totals .value { font-size: 14px; font-weight: 900; margin-top: 3px; white-space: nowrap; }

  .sign {
    border-top: 1px solid #111;
    padding-top: 6px;
    margin-top: 28px;
    width: 90%;
  }
  .sign .k { color:#444; font-size: 10px; }
  .sign .v { margin-top: 4px; font-size: 11px; font-weight: 800; }

  @media print {
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>
  <div class="page">
    <div class="content">
      <div class="companyBar">
        <div class="companyInfo">
          <div class="companyName">${esc(companyName)}</div>
          ${companyAddress ? `<div class="line">${esc(companyAddress)}</div>` : ``}
          ${companyLegal ? `<div class="line muted">${esc(companyLegal)}</div>` : ``}
          ${companyContact ? `<div class="line muted">${esc(companyContact)}</div>` : ``}
        </div>

        <div class="docInfo">
          <div class="docTitle">Claims Transmittal</div>
          <div class="docSub"><span class="mono">${esc(transNo)}</span></div>
          <div class="pill">${esc(status)}</div>
          <div class="docSub">Printed: ${esc(printedAt)}</div>
        </div>
      </div>

      <div class="meta">
        <div class="kv"><div class="k">Supplier</div><div class="v">${esc(supplier)}</div></div>
        <div class="kv"><div class="k">Representative</div><div class="v">${esc(rep)}</div></div>
        <div class="kv"><div class="k">Created</div><div class="v">${esc(createdAt)}</div></div>
        <div class="kv"><div class="k">Created by</div><div class="v">${esc(createdBy)}</div></div>
      </div>

      <table>
        <thead>
          <tr>
            <th style="width: 22%;">Chart of Accounts</th>
            <th style="width: 14%;">Date Received</th>
            <th style="width: 18%;">Credit Memo No.</th>
            <th style="width: 18%;">Customer Name</th>
            <th style="width: 16%;">Remarks</th>
            <th style="width: 12%; text-align:right;">Total</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>

    <div class="footer avoidBreak">
      <div>
        <div class="sign">
          <div class="k">Received and Acknowledged by</div>
          <div class="v">&nbsp;</div>
        </div>
        <div class="muted" style="margin-top:6px;font-size:10px;">
          Signature over printed name / Date
        </div>
      </div>

      <div class="totals">
        <div class="label">Grand Total</div>
        <div class="value">${esc(grandTotalDisplay)}</div>
      </div>
    </div>
  </div>

<script>
  setTimeout(() => window.print(), 250);
</script>
</body>
</html>`;

    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const w = window.open(url, "_blank");
    if (!w) return;

    setTimeout(() => URL.revokeObjectURL(url), 10000);
}