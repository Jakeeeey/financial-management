// src/modules/financial-management/treasury/bank-management/bank-transfers/utils/printBankTransferCheck.ts
import type { BankTransfer } from "../types";

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
    { value: 1_000_000_000_000, label: "trillion" },
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

function renderCheckDate(dateParts: ReturnType<typeof getCheckDateParts>) {
  return [
    renderDateCells(dateParts.month),
    '<span class="dateSeparator" aria-hidden="true"></span>',
    renderDateCells(dateParts.day),
    '<span class="dateSeparator" aria-hidden="true"></span>',
    renderDateCells(dateParts.year),
  ].join("");
}

function normalizeCheckText(value: unknown) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function fitClass(base: string, value: string, mediumAt: number, smallAt: number) {
  if (value.length >= smallAt) return `${base} fitSmall`;
  if (value.length >= mediumAt) return `${base} fitMedium`;
  return base;
}

function fitAmountWordsClass(value: string) {
  if (value.length >= 170) return "value fitTiny";
  return fitClass("value", value, 92, 124);
}

export function printBankTransferCheck(transfer: BankTransfer) {
  const amountWords = amountToPesoWords(transfer.amount);
  const dateParts = getCheckDateParts(transfer.transferDate);
  const payTo = normalizeCheckText(transfer.remarks || transfer.destinationBankName);
  const amountFigure = formatMoney(transfer.amount);
  const payToClass = fitClass("value", payTo, 48, 64);
  const amountFigureClass = fitClass("value", amountFigure, 13, 18);
  const amountWordsClass = fitAmountWordsClass(amountWords);
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
    background: #fff;
    color: #000;
    font-family: Arial, Helvetica, sans-serif;
  }
  .sheet {
    width: 8.5in;
    height: 3.5in;
    margin: 0 auto;
    position: relative;
    overflow: hidden;
  }
  .value {
    position: relative;
    z-index: 1;
    font-size: .16in;
    font-weight: 700;
    text-transform: uppercase;
  }
  .date {
    position: absolute;
    left: 6.16in;
    top: .57in;
    width: 1.82in;
    z-index: 1;
  }
  .dateGrid {
    display: grid;
    grid-template-columns:
      .18in .18in
      .17in
      .18in .18in
      .17in
      .18in .18in .18in .18in;
    align-items: center;
  }
  .dateCell {
    display: inline-flex;
    width: .18in;
    height: .21in;
    align-items: center;
    justify-content: center;
    font-size: .14in;
    font-weight: 800;
    line-height: 1;
  }
  .dateSeparator {
    display: block;
    width: .17in;
    height: .21in;
  }
  .payTo {
    position: absolute;
    left: 1.16in;
    right: 2.72in;
    top: .99in;
    z-index: 1;
  }
  .payTo .value {
    display: block;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .payTo .fitMedium {
    font-size: .145in;
  }
  .payTo .fitSmall {
    font-size: .125in;
  }
  .amountBox {
    position: absolute;
    left: 5.99in;
    top: .98in;
    width: 1.9in;
    z-index: 1;
  }
  .amountBox .value {
    display: block;
    text-align: left;
    white-space: nowrap;
    font-size: .17in;
    font-weight: 800;
  }
  .amountBox .fitMedium {
    font-size: .145in;
  }
  .amountBox .fitSmall {
    font-size: .118in;
  }
  .pesos {
    position: absolute;
    left: .74in;
    right: .48in;
    top: 1.09in;
    height: .38in;
    z-index: 1;
    display: flex;
    align-items: flex-end;
    overflow: visible;
  }
  .pesos .value {
    display: block;
    width: 100%;
    font-size: .145in;
    line-height: 1.16;
    white-space: normal;
    overflow-wrap: break-word;
    word-break: normal;
  }
  .pesos .fitMedium {
    font-size: .128in;
    line-height: 1.12;
  }
  .pesos .fitSmall {
    font-size: .112in;
    line-height: 1.08;
  }
  .pesos .fitTiny {
    font-size: .094in;
    line-height: 1.04;
  }
  @media print {
    .sheet { margin: 0; }
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  }
</style>
</head>
<body>
<div class="sheet">
  <div class="date">
    <div class="dateGrid">${renderCheckDate(dateParts)}</div>
  </div>
  <div class="payTo">
    <div class="${payToClass}">${esc(payTo)}</div>
  </div>
  <div class="amountBox">
    <div class="${amountFigureClass}">${esc(amountFigure)}</div>
  </div>
  <div class="pesos">
    <div class="${amountWordsClass}">${esc(amountWords)}</div>
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
