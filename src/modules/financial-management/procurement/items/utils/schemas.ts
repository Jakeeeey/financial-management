import { z } from "zod";

/**
 * Zod schemas for the procurement items module API routes.
 * Mirrors the unified domain types in items/utils/types.ts.
 */

/** Payload for creating an item (template). */
export const CreateItemSchema = z.object({
  name: z.string().min(1),
  uom: z.string().nullable().optional(),
  base_price: z.number().nonnegative().optional(),
  description: z.string().nullable().optional(),
  is_active: z.boolean().optional(),
});

/** Payload for updating an item (template) — all fields optional. */
export const UpdateItemSchema = CreateItemSchema.partial();

/** Payload for creating a variant. */
export const CreateVariantSchema = z.object({
  item_tmpl_id: z.number().int().positive(),
  name: z.string().min(1),
  uom_id: z.number().int().positive().nullable().optional(),
  list_price: z.number().nonnegative().optional(),
  sku: z.string().nullable().optional(),
  valueIds: z.array(z.number().int().positive()).min(1),
});

/** Payload for updating a variant — all fields optional. Includes sku + active. */
export const UpdateVariantSchema = z.object({
  item_tmpl_id: z.number().int().positive().optional(),
  name: z.string().min(1).optional(),
  uom_id: z.number().int().positive().nullable().optional(),
  list_price: z.number().nonnegative().optional(),
  sku: z.string().nullable().optional(),
  valueIds: z.array(z.number().int().positive()).optional(),
  active: z.boolean().optional(),
});

/** Payload for renaming an attribute. */
export const UpdateAttributeSchema = z.object({
  name: z.string().min(1),
});

/** Payload for renaming an attribute value. */
export const UpdateAttributeValueSchema = z.object({
  name: z.string().min(1),
});