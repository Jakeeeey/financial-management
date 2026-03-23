import type { PaymentTerm } from "@/modules/financial-management/accounting/supplier-management/payment-terms/types";

// Helpers to map between Directus `payment_terms` fields and local PaymentTerm shape

export type PaymentTermSource = {
  id?: string | number | null;
  ID?: string | number | null;
  name?: string | null;
  payment_name?: string | null;
  description?: string | null;
  payment_description?: string | null;
  days?: number | string | null;
  payment_days?: number | string | null;
  isActive?: boolean | null;
  payment_active?: boolean | null;
  createdBy?: unknown;
  created_by?: unknown;
  createdAt?: string | null;
  created_at?: string | null;
  updatedAt?: string | null;
  updated_at?: string | null;
};

function extractCreatedById(createdBy: unknown) {
  if (createdBy == null) return null;

  if (typeof createdBy === "object") {
    const relation = createdBy as {
      user_id?: string | number | null;
      id?: string | number | null;
    };

    if (relation.user_id != null) return String(relation.user_id);
    if (relation.id != null) return String(relation.id);
  }

  return String(createdBy);
}

function extractCreatedByName(createdBy: unknown) {
  if (createdBy == null || typeof createdBy !== "object") return null;

  const relation = createdBy as {
    user_fname?: string | null;
    user_lname?: string | null;
  };

  const firstName = String(relation.user_fname ?? "").trim();
  const lastName = String(relation.user_lname ?? "").trim();
  const fullName = `${firstName} ${lastName}`.trim();

  return fullName || null;
}

export function toLocal(item: PaymentTermSource | null | undefined): PaymentTerm | null {
  if (!item) return null;

  return {
    id: String(item.id ?? item.ID ?? ""),
    name: item.payment_name ?? item.name ?? "",
    description: item.payment_description ?? item.description ?? "",
    // Normalize null/undefined to 0 for days so forms expect a number
    days: Number(item.payment_days ?? item.days ?? 0) || 0,
    isActive: typeof item.payment_active === "boolean" ? item.payment_active : (item.isActive ?? true),
    createdBy: extractCreatedById(item.created_by ?? item.createdBy),
    createdByName: extractCreatedByName(item.created_by ?? item.createdBy),
    createdAt: item.created_at ?? item.createdAt ?? undefined,
    updatedAt: item.updated_at ?? item.updatedAt ?? undefined,
  };
}

export function toRemote(local: { name?: string; description?: string | null; days?: number | null; isActive?: boolean }) {
  return {
    payment_name: local.name ?? null,
    payment_description: local.description ?? null,
    payment_days: local.days ?? null,
    payment_active: typeof local.isActive === "boolean" ? local.isActive : undefined,
  };
}
