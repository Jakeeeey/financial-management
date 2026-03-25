export interface PaymentTerm {
  id: string;
  name: string;
  description?: string;
  days: number;
  isActive: boolean;
  createdBy?: string | null;
  createdByName?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface PaymentTermFormData {
  name: string;
  description?: string;
  days: number;
}
