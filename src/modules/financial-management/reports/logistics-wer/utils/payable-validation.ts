export interface ValidatedPayableLine {
  amount: number;
  referenceNo: string | null;
  remarks: string | null;
  date: string | null;
  coaId: number | null;
  receiptFileIds: string[];
}

export type PayableLineValidation =
  | { valid: true; lines: ValidatedPayableLine[] }
  | { valid: false; error: string };

export type PayableAction = "save-draft" | "submit";

export interface PayableActionState {
  dirty: boolean;
  valid: boolean;
  busy: boolean;
  uploading: boolean;
  submissionBlocked: boolean;
}

interface PayableLineInput {
  amount?: unknown;
  referenceNo?: unknown;
  remarks?: unknown;
  date?: unknown;
  coaId?: unknown;
  receiptFileIds?: unknown;
}

interface PayableFormLineState {
  amount: string;
  referenceNo: string;
  remarks: string;
  date: string;
  coaId: string;
  receipts: Array<{ fileId: string }>;
}

function asTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isValidDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function validatePayableLines(rawLines: unknown, requireCoa: boolean): PayableLineValidation {
  if (!Array.isArray(rawLines) || rawLines.length === 0) {
    return { valid: false, error: "At least one payable line is required." };
  }

  const lines: ValidatedPayableLine[] = [];
  for (let index = 0; index < rawLines.length; index += 1) {
    const raw = (rawLines[index] ?? {}) as PayableLineInput;
    const amount = Number(raw.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return { valid: false, error: `Line ${index + 1} must have an amount greater than zero.` };
    }
    if (Math.abs(amount * 100 - Math.round(amount * 100)) > 1e-6) {
      return { valid: false, error: `Line ${index + 1} amount can have no more than two decimal places.` };
    }

    const date = asTrimmedString(raw.date);
    if (date && !isValidDateOnly(date)) {
      return { valid: false, error: `Line ${index + 1} must use a valid YYYY-MM-DD date.` };
    }

    const coaRaw = raw.coaId;
    const coaId = coaRaw === null || coaRaw === undefined || coaRaw === "" ? null : Number(coaRaw);
    if (requireCoa && (coaId === null || !Number.isInteger(coaId) || coaId <= 0)) {
      return { valid: false, error: `Line ${index + 1} requires a valid chart-of-accounts entry before submission.` };
    }
    if (coaId !== null && (!Number.isInteger(coaId) || coaId <= 0)) {
      return { valid: false, error: `Line ${index + 1} has an invalid chart-of-accounts entry.` };
    }

    const receiptRaw = raw.receiptFileIds;
    const receiptFileIds = receiptRaw === undefined || receiptRaw === null
      ? []
      : (Array.isArray(receiptRaw) ? receiptRaw : [receiptRaw]).map(asTrimmedString).filter(Boolean);
    lines.push({
      amount,
      referenceNo: asTrimmedString(raw.referenceNo) || null,
      remarks: asTrimmedString(raw.remarks) || null,
      date: date || null,
      coaId,
      receiptFileIds: Array.from(new Set(receiptFileIds)),
    });
  }

  return { valid: true, lines };
}

export function isPayableFormDirty(
  current: PayableFormLineState[],
  baseline: PayableFormLineState[],
): boolean {
  if (current.length !== baseline.length) return true;
  return current.some((line, index) => {
    const initial = baseline[index];
    return line.amount !== initial.amount
      || line.referenceNo !== initial.referenceNo
      || line.remarks !== initial.remarks
      || line.date !== initial.date
      || line.coaId !== initial.coaId
      || line.receipts.length !== initial.receipts.length
      || line.receipts.some((receipt, receiptIndex) => receipt.fileId !== initial.receipts[receiptIndex]?.fileId);
  });
}

export function canRunPayableAction(action: PayableAction, state: PayableActionState): boolean {
  return state.dirty
    && state.valid
    && !state.busy
    && !state.uploading
    && (action === "save-draft" || !state.submissionBlocked);
}
