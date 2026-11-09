import "server-only";

import type { CertificateBody, PaymentBody } from "../schemas";
import type { CertificateInput } from "./certificates.service";
import type { PaymentInput } from "./payments.service";

function trimmedOrNull(value: string | null | undefined): string | null {
  const text = (value ?? "").trim();
  return text === "" ? null : text;
}

export function toCertificateInput(body: CertificateBody): CertificateInput {
  return {
    companyId: body.companyId,
    taxYear: body.year,
    periodKey: body.periodKey,
    direction: body.direction,
    counterpartyCompanyId: body.counterpartyCompanyId ?? null,
    counterpartyName: body.counterpartyName.trim(),
    counterpartyTin: trimmedOrNull(body.counterpartyTin),
    incomeType: body.incomeType,
    incomeAmount: body.incomeAmount,
    taxRate: body.taxRate,
    taxWithheld: body.taxWithheld,
    dateReceived: body.dateReceived ?? null,
    remarks: trimmedOrNull(body.remarks),
  };
}

export function toPaymentInput(body: PaymentBody): PaymentInput {
  return {
    companyId: body.companyId,
    taxYear: body.year,
    periodKey: body.periodKey,
    formCode: body.formCode,
    paidOn: body.paidOn,
    amount: body.amount,
    referenceNo: trimmedOrNull(body.referenceNo),
    remarks: trimmedOrNull(body.remarks),
  };
}
