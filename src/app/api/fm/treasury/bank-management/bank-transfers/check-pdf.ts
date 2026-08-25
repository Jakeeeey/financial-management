import jsPDF from "jspdf";
import {
  asNumber,
  asString,
  directusFetch,
  DirectusList,
} from "./_utils";

type BankTransferCheckRow = {
  transfer_id?: unknown;
  transfer_no?: unknown;
  reference_number?: unknown;
  transaction_type?: unknown;
  transfer_date?: unknown;
  source_bank_id?: unknown;
  destination_bank_id?: unknown;
  amount?: unknown;
  status?: unknown;
  remarks?: unknown;
};

type BankAccountRow = {
  bank_id?: unknown;
  bank_name?: unknown;
  account_number?: unknown;
  branch?: unknown;
};

type PaymentMethodRow = {
  method_id?: unknown;
  method_name?: unknown;
};

export type CheckPrintTransfer = {
  transferId: number;
  transferNo: string;
  referenceNumber: string;
  transactionTypeId: number;
  transactionTypeName: string;
  transferDate: string;
  destinationBankName: string;
  amount: number;
  status: string;
  remarks: string;
};

export class CheckPrintError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "CheckPrintError";
    this.status = status;
  }
}

const POINTS_PER_INCH = 72;
const POINTS_PER_MM = POINTS_PER_INCH / 25.4;
const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const CHECK_WIDTH_MM = 203.2;
const CHECK_HEIGHT_MM = 76.2;
const A4_WIDTH = A4_WIDTH_MM * POINTS_PER_MM;
const A4_HEIGHT = A4_HEIGHT_MM * POINTS_PER_MM;
const CHECK_WIDTH = CHECK_WIDTH_MM * POINTS_PER_MM;
const CHECK_HEIGHT = CHECK_HEIGHT_MM * POINTS_PER_MM;
const CHECK_ORIGIN_X = (A4_WIDTH - CHECK_WIDTH) / 2;
const CHECK_ORIGIN_Y = 0;

type PointOffset = {
  xMm: number;
  yMm: number;
};

type DateTemplateMm = {
  xMm: number;
  yMm: number;
  cellWidthMm: number;
  separatorWidthMm: number;
  fontSize: number;
};

type SingleLineTemplateMm = {
  xMm: number;
  yMm: number;
  widthMm: number;
  fontSize: number;
  minimumFontSize: number;
};

type AmountWordsTemplateMm = {
  xMm: number;
  bottomYMm: number;
  widthMm: number;
  fontSize: number;
  minimumFontSize: number;
  lineHeightMultiplier: number;
  maxLines: number;
};

type CheckTemplateMm = {
  date: DateTemplateMm;
  payee: SingleLineTemplateMm;
  amountFigure: SingleLineTemplateMm;
  amountWords: AmountWordsTemplateMm;
};

type CheckCalibrationOffsets = {
  date: PointOffset;
  payee: PointOffset;
  amountFigure: PointOffset;
  amountWords: PointOffset;
};

type CheckOrigin = {
  x: number;
  y: number;
};

const bpiMeasuredTemplate: CheckTemplateMm = {
  date: {
    xMm: 156.46,
    yMm: 14.48,
    cellWidthMm: 4.57,
    separatorWidthMm: 4.32,
    fontSize: 10,
  },
  payee: {
    xMm: 29.46,
    yMm: 25.15,
    widthMm: 90.17,
    fontSize: 11,
    minimumFontSize: 7,
  },
  amountFigure: {
    xMm: 152.15,
    yMm: 24.89,
    widthMm: 48.26,
    fontSize: 12,
    minimumFontSize: 7,
  },
  amountWords: {
    xMm: 18.8,
    bottomYMm: 37.34,
    widthMm: 172.21,
    fontSize: 10.5,
    minimumFontSize: 6.5,
    lineHeightMultiplier: 1.08,
    maxLines: 3,
  },
};

// Enter measured drift here after printing the calibration PDF at actual size.
// Positive X moves right. Negative X moves left. Positive Y moves down. Negative Y moves up.
const checkCalibrationOffsets: CheckCalibrationOffsets = {
  date: { xMm: -5, yMm: 0 },
  payee: { xMm: 3, yMm: -2 },
  amountFigure: { xMm: -5, yMm: -3 },
  amountWords: { xMm: 4, yMm: 0 },
};

function mmToPt(value: number) {
  return value * POINTS_PER_MM;
}

function applyOffset(valueMm: number, offsetMm: number) {
  return mmToPt(valueMm + offsetMm);
}

function resolveCheckTemplate(
  template: CheckTemplateMm,
  offsets: CheckCalibrationOffsets,
  origin: CheckOrigin,
) {
  return {
    date: {
      x: origin.x + applyOffset(template.date.xMm, offsets.date.xMm),
      y: origin.y + applyOffset(template.date.yMm, offsets.date.yMm),
      cellWidth: mmToPt(template.date.cellWidthMm),
      separatorWidth: mmToPt(template.date.separatorWidthMm),
      fontSize: template.date.fontSize,
    },
    payee: {
      x: origin.x + applyOffset(template.payee.xMm, offsets.payee.xMm),
      y: origin.y + applyOffset(template.payee.yMm, offsets.payee.yMm),
      width: mmToPt(template.payee.widthMm),
      fontSize: template.payee.fontSize,
      minimumFontSize: template.payee.minimumFontSize,
    },
    amountFigure: {
      x: origin.x + applyOffset(template.amountFigure.xMm, offsets.amountFigure.xMm),
      y: origin.y + applyOffset(template.amountFigure.yMm, offsets.amountFigure.yMm),
      width: mmToPt(template.amountFigure.widthMm),
      fontSize: template.amountFigure.fontSize,
      minimumFontSize: template.amountFigure.minimumFontSize,
    },
    amountWords: {
      x: origin.x + applyOffset(template.amountWords.xMm, offsets.amountWords.xMm),
      bottomY:
        origin.y + applyOffset(template.amountWords.bottomYMm, offsets.amountWords.yMm),
      width: mmToPt(template.amountWords.widthMm),
      fontSize: template.amountWords.fontSize,
      minimumFontSize: template.amountWords.minimumFontSize,
      lineHeightMultiplier: template.amountWords.lineHeightMultiplier,
      maxLines: template.amountWords.maxLines,
    },
  };
}

const checkTemplate = resolveCheckTemplate(
  bpiMeasuredTemplate,
  checkCalibrationOffsets,
  { x: CHECK_ORIGIN_X, y: CHECK_ORIGIN_Y },
);

function applyCheckPrintPreferences(doc: jsPDF) {
  // Printer drivers may still ask for confirmation, but these hints keep the A4 carrier page at actual size.
  doc.viewerPreferences({
    DisplayDocTitle: true,
    ViewArea: "MediaBox",
    ViewClip: "MediaBox",
    PrintArea: "MediaBox",
    PrintClip: "MediaBox",
    PrintScaling: "None",
    PickTrayByPDFSize: true,
  });
  doc.autoPrint({ variant: "javascript" });
}

function createCheckPdf(title: string) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "pt",
    format: [A4_WIDTH, A4_HEIGHT],
    compress: true,
  });

  doc.setProperties({
    title,
    subject: "Bank transfer check print",
  });

  applyCheckPrintPreferences(doc);

  return doc;
}

function normalizeCheckText(value: unknown) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
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

function getCheckDateDigits(value: string) {
  const empty = ["", "", "", "", "", "", "", ""];
  if (!value) return empty;

  const isoDate = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoDate) return [...isoDate[2], ...isoDate[3], ...isoDate[1]];

  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return empty;

  const pad = (part: number) => String(part).padStart(2, "0");
  return [
    ...pad(date.getMonth() + 1),
    ...pad(date.getDate()),
    ...String(date.getFullYear()).padStart(4, "0"),
  ];
}

function fitFontSize(
  doc: jsPDF,
  text: string,
  width: number,
  startSize: number,
  minimumSize: number,
) {
  let size = startSize;
  doc.setFontSize(size);

  while (size > minimumSize && doc.getTextWidth(text) > width) {
    size -= 0.5;
    doc.setFontSize(size);
  }

  return size;
}

function splitAmountWords(doc: jsPDF, text: string) {
  let size = checkTemplate.amountWords.fontSize;
  let lines: string[] = [];

  while (size >= checkTemplate.amountWords.minimumFontSize) {
    doc.setFontSize(size);
    lines = doc.splitTextToSize(text, checkTemplate.amountWords.width) as string[];
    if (lines.length <= checkTemplate.amountWords.maxLines) break;
    size -= 0.5;
  }

  return { lines, size: Math.max(size, checkTemplate.amountWords.minimumFontSize) };
}

function drawDate(doc: jsPDF, digits: string[]) {
  const separatorIndexes = new Set([2, 4]);
  let x = checkTemplate.date.x;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(checkTemplate.date.fontSize);

  digits.forEach((digit, index) => {
    if (separatorIndexes.has(index)) x += checkTemplate.date.separatorWidth;
    doc.text(digit, x + checkTemplate.date.cellWidth / 2, checkTemplate.date.y, {
      align: "center",
      baseline: "middle",
    });
    x += checkTemplate.date.cellWidth;
  });
}

function drawSingleLineField(
  doc: jsPDF,
  text: string,
  options: {
    x: number;
    y: number;
    width: number;
    fontSize: number;
    minimumFontSize: number;
  },
) {
  doc.setFont("helvetica", "bold");
  const size = fitFontSize(
    doc,
    text,
    options.width,
    options.fontSize,
    options.minimumFontSize,
  );
  doc.setFontSize(size);
  doc.text(text, options.x, options.y, { baseline: "middle", maxWidth: options.width });
}

function drawAmountWords(doc: jsPDF, text: string) {
  const { lines, size } = splitAmountWords(doc, text);
  const lineHeight = size * checkTemplate.amountWords.lineHeightMultiplier;
  const firstLineY =
    checkTemplate.amountWords.bottomY - Math.max(lines.length - 1, 0) * lineHeight;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(size);
  lines.forEach((line, index) => {
    doc.text(line, checkTemplate.amountWords.x, firstLineY + index * lineHeight, {
      baseline: "middle",
      maxWidth: checkTemplate.amountWords.width,
    });
  });
}

function drawCrosshair(doc: jsPDF, x: number, y: number, size = 5) {
  doc.line(x - size, y, x + size, y);
  doc.line(x, y - size, x, y + size);
}

function drawCalibrationField(
  doc: jsPDF,
  label: string,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.6);
  doc.rect(x, y, width, height);
  doc.setDrawColor(180, 180, 180);
  doc.line(x, y + height / 2, x + width, y + height / 2);
  doc.setDrawColor(0, 0, 0);
  drawCrosshair(doc, x, y + height / 2);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6);
  doc.text(label, x + 2, y - 3);
}

function drawCalibrationGrid(doc: jsPDF) {
  const minorStep = mmToPt(5);
  const majorStep = mmToPt(10);
  const checkRight = CHECK_ORIGIN_X + CHECK_WIDTH;
  const checkBottom = CHECK_ORIGIN_Y + CHECK_HEIGHT;

  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.2);

  for (let x = CHECK_ORIGIN_X; x <= checkRight; x += minorStep) {
    doc.line(x, CHECK_ORIGIN_Y, x, checkBottom);
  }
  for (let y = CHECK_ORIGIN_Y; y <= checkBottom; y += minorStep) {
    doc.line(CHECK_ORIGIN_X, y, checkRight, y);
  }

  doc.setDrawColor(150, 150, 150);
  doc.setLineWidth(0.35);
  for (let x = CHECK_ORIGIN_X; x <= checkRight; x += majorStep) {
    doc.line(x, CHECK_ORIGIN_Y, x, checkBottom);
  }
  for (let y = CHECK_ORIGIN_Y; y <= checkBottom; y += majorStep) {
    doc.line(CHECK_ORIGIN_X, y, checkRight, y);
  }
}

function drawCalibrationDate(doc: jsPDF) {
  const field = checkTemplate.date;
  const labels = ["M", "M", "D", "D", "Y", "Y", "Y", "Y"];
  const separatorIndexes = new Set([2, 4]);
  let x = field.x;

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.6);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6);
  doc.text("DATE CELLS", field.x, field.y - 16);

  labels.forEach((label, index) => {
    if (separatorIndexes.has(index)) x += field.separatorWidth;
    const y = field.y - 8;
    doc.rect(x, y, field.cellWidth, 16);
    doc.text(label, x + field.cellWidth / 2, y + 21, { align: "center" });
    drawCrosshair(doc, x + field.cellWidth / 2, field.y, 3);
    x += field.cellWidth;
  });
}

function drawCalibrationInstructions(doc: jsPDF) {
  const lines = [
    "Print at Actual Size / 100%. Minor grid = 5mm, major grid = 10mm.",
    "Measure drift from the physical check: +X right, -X left, +Y down, -Y up.",
    "Apply measured values in checkCalibrationOffsets; both calibration and real PDFs use them.",
  ];

  doc.setFont("helvetica", "normal");
  doc.setFontSize(5.5);
  lines.forEach((line, index) => {
    doc.text(
      line,
      CHECK_ORIGIN_X + 8,
      CHECK_ORIGIN_Y + CHECK_HEIGHT - 16 + index * 6,
    );
  });
}

export function generateBankTransferCheckCalibrationPdf() {
  const doc = createCheckPdf("Bank transfer check calibration");
  const amountWordsHeight =
    checkTemplate.amountWords.fontSize *
    checkTemplate.amountWords.lineHeightMultiplier *
    checkTemplate.amountWords.maxLines;

  doc.setTextColor(0, 0, 0);
  drawCalibrationGrid(doc);

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(1);
  doc.rect(CHECK_ORIGIN_X, CHECK_ORIGIN_Y, CHECK_WIDTH, CHECK_HEIGHT);

  drawCalibrationDate(doc);
  drawCalibrationField(
    doc,
    "PAY TO THE ORDER OF",
    checkTemplate.payee.x,
    checkTemplate.payee.y - 8,
    checkTemplate.payee.width,
    16,
  );
  drawCalibrationField(
    doc,
    "AMOUNT IN FIGURES",
    checkTemplate.amountFigure.x,
    checkTemplate.amountFigure.y - 8,
    checkTemplate.amountFigure.width,
    16,
  );
  drawCalibrationField(
    doc,
    "PESOS IN WORDS",
    checkTemplate.amountWords.x,
    checkTemplate.amountWords.bottomY - amountWordsHeight,
    checkTemplate.amountWords.width,
    amountWordsHeight,
  );

  drawCalibrationInstructions(doc);

  return Buffer.from(doc.output("arraybuffer"));
}

function normalizeBank(row: BankAccountRow | undefined) {
  return {
    bankId: asNumber(row?.bank_id) ?? 0,
    bankName: asString(row?.bank_name),
    accountNumber: asString(row?.account_number),
    branch: asString(row?.branch),
  };
}

async function getBank(bankId: number) {
  if (!bankId) return normalizeBank(undefined);

  const params = new URLSearchParams();
  params.set("fields", "bank_id,bank_name,account_number,branch");
  params.set("limit", "1");
  params.set("filter[bank_id][_eq]", String(bankId));
  const res = await directusFetch<DirectusList<BankAccountRow>>(
    `/items/bank_accounts?${params.toString()}`,
  );
  return normalizeBank(res.data?.[0]);
}

async function getPaymentMethod(methodId: number) {
  if (!methodId) return "";

  const params = new URLSearchParams();
  params.set("fields", "method_id,method_name");
  params.set("limit", "1");
  params.set("filter[method_id][_eq]", String(methodId));
  const res = await directusFetch<DirectusList<PaymentMethodRow>>(
    `/items/payment_methods?${params.toString()}`,
  );
  return asString(res.data?.[0]?.method_name);
}

function isCheckTransfer(transfer: CheckPrintTransfer) {
  return (
    transfer.transactionTypeId === 4 ||
    transfer.transactionTypeName.toUpperCase() === "CHECK"
  );
}

export function getCheckPdfFilename(transfer: CheckPrintTransfer) {
  const rawName = transfer.referenceNumber || transfer.transferNo || "bank-transfer-check";
  return `${rawName.replace(/[^A-Za-z0-9_-]+/g, "-")}.pdf`;
}

export async function getPrintableCheckTransfer(transferId: number) {
  const params = new URLSearchParams();
  params.set(
    "fields",
    [
      "transfer_id",
      "transfer_no",
      "reference_number",
      "transaction_type",
      "transfer_date",
      "source_bank_id",
      "destination_bank_id",
      "amount",
      "status",
      "remarks",
    ].join(","),
  );
  params.set("limit", "1");
  params.set("filter[transfer_id][_eq]", String(transferId));

  const res = await directusFetch<DirectusList<BankTransferCheckRow>>(
    `/items/bank_transfers?${params.toString()}`,
  );
  const row = res.data?.[0];
  if (!row) throw new CheckPrintError("Bank transfer not found", 404);

  const destinationBankId = asNumber(row?.destination_bank_id) ?? 0;
  const transactionTypeId = asNumber(row?.transaction_type) ?? 0;
  const [destinationBank, transactionTypeName] = await Promise.all([
    getBank(destinationBankId),
    getPaymentMethod(transactionTypeId),
  ]);

  const transfer: CheckPrintTransfer = {
    transferId: asNumber(row?.transfer_id) ?? transferId,
    transferNo: asString(row?.transfer_no),
    referenceNumber: asString(row?.reference_number),
    transactionTypeId,
    transactionTypeName,
    transferDate: asString(row?.transfer_date),
    destinationBankName: destinationBank.bankName || `Bank #${destinationBankId}`,
    amount: asNumber(row?.amount) ?? 0,
    status: asString(row?.status).toUpperCase(),
    remarks: asString(row?.remarks),
  };

  if (!transfer.transferId) throw new CheckPrintError("Bank transfer not found", 404);
  if (transfer.status === "CANCELLED") {
    throw new CheckPrintError("Cancelled transfers cannot be printed as checks");
  }
  if (!isCheckTransfer(transfer)) {
    throw new CheckPrintError("Only check payment method transfers can be printed as checks");
  }

  return transfer;
}

export function generateBankTransferCheckPdf(transfer: CheckPrintTransfer) {
  const doc = createCheckPdf(`Check ${transfer.referenceNumber || transfer.transferNo}`);
  const payee = normalizeCheckText(transfer.remarks || transfer.destinationBankName);
  const amountFigure = formatMoney(transfer.amount);
  const amountWords = amountToPesoWords(transfer.amount);

  doc.setTextColor(0, 0, 0);

  drawDate(doc, getCheckDateDigits(transfer.transferDate));
  drawSingleLineField(doc, payee, checkTemplate.payee);
  drawSingleLineField(doc, amountFigure, checkTemplate.amountFigure);
  drawAmountWords(doc, amountWords);

  return Buffer.from(doc.output("arraybuffer"));
}
