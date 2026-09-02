import { z } from "zod";

/**
 * Zod schemas for the procurement items module API routes.
 * Mirrors the unified domain types in items/utils/types.ts.
 */

/** Payload for creating an item (template). */
export const CreateItemSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  is_active: z.boolean().optional(),
});

/** Payload for updating an item (template) — all fields optional. */
export const UpdateItemSchema = CreateItemSchema.partial();

/** Payload for creating a variant. */
export const CreateVariantSchema = z
  .object({
    item_tmpl_id: z.number().int().positive(),
    name: z.string().min(1),
    uom_id: z.number().int().positive().nullable().optional(),
    list_price: z.number().nonnegative().optional(),
    sku: z.string().nullable().optional(),
    valueIds: z.array(z.number().int().positive()).optional(),
  })
  .superRefine((data, ctx) => {
    if ((!data.valueIds || data.valueIds.length === 0) && data.uom_id == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["uom_id"],
        message: "A UOM is required when the variant has no attribute values",
      });
    }
  });

/** Payload for updating a variant — all fields optional. Includes sku + active. */
export const UpdateVariantSchema = z
  .object({
    item_tmpl_id: z.number().int().positive().optional(),
    name: z.string().min(1).optional(),
    uom_id: z.number().int().positive().nullable().optional(),
    list_price: z.number().nonnegative().optional(),
    sku: z.string().nullable().optional(),
    valueIds: z.array(z.number().int().positive()).optional(),
    active: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.valueIds && data.valueIds.length === 0 && data.uom_id == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["uom_id"],
        message: "A UOM is required when the variant has no attribute values",
      });
    }
  });

/** Payload for renaming an attribute. */
export const UpdateAttributeSchema = z.object({
  name: z.string().min(1),
});

/** Payload for renaming an attribute value. */
export const UpdateAttributeValueSchema = z.object({
  name: z.string().min(1),
});