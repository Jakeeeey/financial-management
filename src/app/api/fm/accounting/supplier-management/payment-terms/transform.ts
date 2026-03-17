// Helpers to map between Directus `payment_terms` fields and local PaymentTerm shape

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

export function toLocal(item: any) {
  if (!item) return null;

  return {
    id: String(item.id ?? item.ID ?? ""),
    name: item.payment_name ?? item.payment_name ?? item.name ?? "",
    description: item.payment_description ?? item.payment_description ?? item.description ?? "",
    // Normalize null/undefined to 0 for days so forms expect a number
    days: Number(item.payment_days ?? item.payment_days ?? item.days ?? 0) || 0,
    isActive: typeof item.payment_active === "boolean" ? item.payment_active : (item.isActive ?? true),
    createdBy: extractCreatedById(item.created_by ?? item.createdBy),
    createdByName: extractCreatedByName(item.created_by ?? item.createdBy),
    createdAt: item.created_at ?? item.createdAt ?? null,
    updatedAt: item.updated_at ?? item.updatedAt ?? null,
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
