// src/modules/financial-management/treasury/bank-management/bank-transfers/utils/printBankTransferCheck.ts
import type { BankTransfer } from "../types";

const ACCOUNT_NAME = "MEN2 MARKETING & DISTRIBUTION ENT. CORP.";

function esc(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatMoney(value: number) {
  return Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function numberUnderThousandToWords(value: number) {
  const ones = [
    "",
    "one",
    "two",
    "three",
    "four",
    "five",
    "six",
    "seven",
    "eight",
    "nine",
    "ten",
    "eleven",
    "twelve",
    "thirteen",
    "fourteen",
    "fifteen",
    "sixteen",
    "seventeen",
    "eighteen",
    "nineteen",
  ];
  const tens = [
    "",
    "",
    "twenty",
    "thirty",
    "forty",
    "fifty",
    "sixty",
    "seventy",
    "eighty",
    "ninety",
  ];
  const parts: string[] = [];
  const hundreds = Math.floor(value / 100);
  const remainder = value % 100;

  if (hundreds > 0) parts.push(`${ones[hundreds]} hundred`);
  if (remainder >= 20) {
    parts.push(
      [tens[Math.floor(remainder / 10)], ones[remainder % 10]]
        .filter(Boolean)
        .join(" "),
    );
  } else if (remainder > 0) {
    parts.push(ones[remainder]);
  }

  return parts.join(" ");
}

function integerToWords(value: number) {
  if (value === 0) return "zero";

  const scales = [
    { value: 1_000_000_000, label: "billion" },
    { value: 1_000_000, label: "million" },
    { value: 1_000, label: "thousand" },
    { value: 1, label: "" },
  ];
  const parts: string[] = [];
  let remaining = Math.floor(value);

  for (const scale of scales) {
    const segment = Math.floor(remaining / scale.value);
    if (segment === 0) continue;
    parts.push(
      [numberUnderThousandToWords(segment), scale.label].filter(Boolean).join(" "),
    );
    remaining %= scale.value;
  }

  return parts.join(" ");
}

function amountToPesoWords(amount: number) {
  const rounded = Math.round(Number(amount || 0) * 100);
  const pesos = Math.floor(rounded / 100);
  const cents = rounded % 100;
  const pesoWords = `${integerToWords(pesos)} ${pesos === 1 ? "peso" : "pesos"}`;

  if (cents === 0) return `${pesoWords} only`.toUpperCase();
  return `${pesoWords} and ${integerToWords(cents)} ${cents === 1 ? "centavo" : "centavos"} only`.toUpperCase();
}

function getCheckDateParts(value: string) {
  const emptyParts = {
    month: ["", ""],
    day: ["", ""],
    year: ["", "", "", ""],
  };

  if (!value) return emptyParts;

  const isoDate = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoDate) {
    return {
      month: isoDate[2].split(""),
      day: isoDate[3].split(""),
      year: isoDate[1].split(""),
    };
  }

  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return emptyParts;

  const pad = (part: number) => String(part).padStart(2, "0");
  return {
    month: pad(date.getMonth() + 1).split(""),
    day: pad(date.getDate()).split(""),
    year: String(date.getFullYear()).padStart(4, "0").split(""),
  };
}

function renderDateCells(values: string[]) {
  return values.map((value) => `<span class="dateCell">${esc(value)}</span>`).join("");
}

export function printBankTransferCheck(transfer: BankTransfer) {
  const amountWords = amountToPesoWords(transfer.amount);
  const dateParts = getCheckDateParts(transfer.transferDate);
  const payTo = transfer.remarks || transfer.destinationBankName;
  const title = `Check ${transfer.referenceNumber || transfer.transferNo}`;
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${esc(title)}</title>
<style>
  @page { size: 8.5in 3.5in landscape; margin: 0; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: #f3f3ef;
    color: #1e1b16;
    font-family: Arial, Helvetica, sans-serif;
  }
  .sheet {
    width: 8.5in;
    height: 3.5in;
    margin: 0 auto;
    padding: .2in .26in;
    background:
      repeating-linear-gradient(90deg, rgba(185, 160, 85, .10) 0 1px, transparent 1px 5px),
      #fbf7df;
    position: relative;
    overflow: hidden;
    border: 1px solid #d6c98d;
  }
  .top {
    display: grid;
    grid-template-columns: 2.1in 1fr 1.25in;
    gap: .16in;
    align-items: start;
    position: relative;
    z-index: 1;
  }
  .bank {
    font-weight: 800;
    font-size: .17in;
    line-height: 1.1;
    color: #9b3b27;
    text-transform: uppercase;
  }
  .branch {
    margin-top: .06in;
    font-size: .09in;
    font-weight: 700;
    line-height: 1.25;
    text-transform: uppercase;
  }
  .account {
    text-align: right;
    font-size: .1in;
    line-height: 1.25;
    font-weight: 700;
    text-transform: uppercase;
  }
  .checkNo {
    text-align: right;
    font-size: .11in;
    line-height: 1.25;
    font-weight: 700;
    text-transform: uppercase;
  }
  .checkNo .value {
    display: block;
    margin-top: .04in;
    font-size: .18in;
    letter-spacing: .01in;
  }
  .main {
    position: relative;
    z-index: 1;
    margin-top: .32in;
    display: grid;
    grid-template-columns: .9in minmax(0, 1fr) 1.65in;
    gap: .1in;
    align-items: end;
  }
  .label {
    font-size: .1in;
    text-transform: uppercase;
    font-weight: 700;
    color: #4e4538;
  }
  .line {
    min-height: .22in;
    border-bottom: 1.5px solid #2e2a22;
    padding: 0 .04in .03in .04in;
    font-size: .16in;
    font-weight: 700;
    text-transform: uppercase;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .amountBox {
    display: grid;
    grid-template-columns: .34in minmax(0, 1fr);
    gap: .06in;
    align-items: end;
    min-width: 0;
  }
  .currency {
    font-size: .12in;
    font-weight: 800;
    padding-bottom: .04in;
  }
  .amount {
    border-bottom: 1.5px solid #2e2a22;
    text-align: right;
    font-size: .14in;
    font-weight: 800;
    padding-bottom: .03in;
    white-space: nowrap;
  }
  .pesos {
    position: relative;
    z-index: 1;
    margin-top: .18in;
    display: grid;
    grid-template-columns: .72in 1fr;
    gap: .12in;
    align-items: end;
  }
  .pesos .line {
    font-size: .13in;
    white-space: normal;
    line-height: 1.25;
    min-height: .38in;
  }
  .memo {
    position: relative;
    z-index: 1;
    margin-top: .24in;
    display: grid;
    grid-template-columns: 2.8in 1fr;
    gap: .36in;
    align-items: start;
  }
  .consent {
    font-size: .09in;
    font-style: italic;
    text-align: center;
    line-height: 1.25;
    color: #4b453a;
  }
  .signature {
    margin-top: .28in;
    border-top: 1px solid #333;
    padding-top: .04in;
    text-align: center;
    font-size: .085in;
    text-transform: uppercase;
  }
  .footer {
    position: absolute;
    left: .26in;
    right: .26in;
    bottom: .14in;
    display: flex;
    justify-content: space-between;
    align-items: end;
    font-family: "Courier New", monospace;
    font-size: .16in;
    font-weight: 700;
    letter-spacing: .015in;
  }
  .date {
    position: absolute;
    right: .26in;
    top: .84in;
    display: grid;
    grid-template-columns: .35in auto;
    gap: .08in;
    align-items: end;
    z-index: 2;
  }
  .dateBox {
    display: flex;
    align-items: center;
    gap: .025in;
    padding-top: .015in;
  }
  .dateGroup {
    display: flex;
    align-items: center;
  }
  .dateCell {
    display: inline-flex;
    width: .13in;
    height: .21in;
    align-items: center;
    justify-content: center;
    border-top: 1px solid rgba(46, 42, 34, .55);
    border-bottom: 1.5px solid #2e2a22;
    border-left: 1px solid rgba(46, 42, 34, .55);
    font-size: .095in;
    font-weight: 700;
    line-height: 1.1;
    padding-top: .005in;
  }
  .dateCell:last-child {
    border-right: 1px solid rgba(46, 42, 34, .55);
  }
  .dateDash {
    padding: 0 .015in .01in;
    font-size: .1in;
    font-weight: 700;
    line-height: 1;
  }
  @media print {
    body { background: #fff; }
    .sheet { border: none; margin: 0; }
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  }
</style>
</head>
<body>
<div class="sheet">
  <div class="top">
    <div>
      <div class="bank">${esc(transfer.sourceBankName)}</div>
      <div class="branch">Source bank account</div>
    </div>
    <div class="account">
      <div>Account No.</div>
      <div>${esc(transfer.sourceBankAccountNumber || "N/A")}</div>
      <div style="margin-top:.12in;">Account Name</div>
      <div>${esc(ACCOUNT_NAME)}</div>
    </div>
    <div class="checkNo">
      <div>Check No.</div>
      <span class="value">${esc(transfer.referenceNumber || "N/A")}</span>
    </div>
  </div>
  <div class="date">
    <div class="label">Date</div>
    <div class="dateBox">
      <div class="dateGroup">${renderDateCells(dateParts.month)}</div>
      <span class="dateDash">-</span>
      <div class="dateGroup">${renderDateCells(dateParts.day)}</div>
      <span class="dateDash">-</span>
      <div class="dateGroup">${renderDateCells(dateParts.year)}</div>
    </div>
  </div>
  <div class="main">
    <div class="label">Pay to the<br/>order of</div>
    <div class="line">${esc(payTo)}</div>
    <div class="amountBox">
      <div class="currency">PHP</div>
      <div class="amount">${esc(formatMoney(transfer.amount))}</div>
    </div>
  </div>
  <div class="pesos">
    <div class="label">Pesos</div>
    <div class="line">${esc(amountWords)}</div>
  </div>
  <div class="memo">
    <div class="consent">
      I/We allow the electronic clearing of this check and hereby waive the presentation for payment of this original to the bank.
    </div>
    <div class="signature">Authorized Signature(s)</div>
  </div>
  <div class="footer">
    <span>${esc(transfer.sourceBankAccountNumber || "0000000000")}</span>
    <span>${esc(transfer.referenceNumber || transfer.transferNo)}</span>
  </div>
</div>
<script>setTimeout(() => window.print(), 300);</script>
</body>
</html>`;
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const printWindow = window.open(url, "_blank");
  if (!printWindow) return;
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
