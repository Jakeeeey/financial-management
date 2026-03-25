export interface PaymentTermRecord {
  id: string;
  name: string;
  description?: string;
  days: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

let paymentTerms: PaymentTermRecord[] = [];

export function getAll() {
  return paymentTerms;
}

export function findById(id: string) {
  return paymentTerms.find((p) => p.id === id) ?? null;
}

export function add(term: Omit<PaymentTermRecord, "id" | "createdAt" | "updatedAt">) {
  const newTerm: PaymentTermRecord = {
    id: String(paymentTerms.length + 1),
    ...term,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  paymentTerms.push(newTerm);
  return newTerm;
}

export function update(id: string, data: Partial<PaymentTermRecord>) {
  const idx = paymentTerms.findIndex((p) => p.id === id);
  if (idx === -1) return null;
  paymentTerms[idx] = {
    ...paymentTerms[idx],
    ...data,
    updatedAt: new Date().toISOString(),
  };
  return paymentTerms[idx];
}

export function remove(id: string) {
  const idx = paymentTerms.findIndex((p) => p.id === id);
  if (idx === -1) return false;
  paymentTerms.splice(idx, 1);
  return true;
}

export function clearAll() {
  paymentTerms = [];
}
