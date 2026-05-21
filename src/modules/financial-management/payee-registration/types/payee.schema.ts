import { z } from "zod";

/**
 * Payee Schema - Zod validation for payee entity (Non-Trade)
 */
export const PayeeSchema = z.object({
  id: z.number().optional(),
  supplier_name: z
    .string()
    .min(2, "Payee name must be at least 2 characters")
    .max(255, "Payee name is too long"),
  supplier_shortcut: z.string().optional().default(""),
  supplier_type: z.string().default("Non-Trade"),
  tin_number: z
    .string()
    .transform((val) => val.replace(/\D/g, ""))
    .refine((val) => val.length >= 9 && val.length <= 12, {
      message: "TIN must be 9-12 digits",
    }),
  contact_person: z.string().min(2, "Contact person name is required"),
  email_address: z
    .string()
    .email("Invalid email address")
    .or(z.literal("N/A"))
    .or(z.literal(""))
    .optional()
    .default(""),
  phone_number: z.string().optional().default(""),
  address: z.string().min(1, "Address is required"),
  brgy: z.string().min(1, "Barangay is required"),
  city: z.string().min(1, "City is required"),
  state_province: z.string().min(1, "Province is required"),
  postal_code: z.string().min(1, "Postal code is required"),
  country: z.string().min(1, "Country is required").default("Philippines"),
  payment_terms: z.string().min(1, "Payment terms are required"),
  delivery_terms: z.string().min(1, "Delivery terms are required"),
  date_added: z.string().or(z.date()).optional(),
  isActive: z.number().int().min(0).max(1).default(1),
  supplier_image: z.string().optional().default(""),
  bank_details: z.string().optional().default(""),
  notes_or_comments: z.string().optional().default(""),
  agreement_or_contract: z.string().optional().default(""),
  preferred_communication_method: z.string().optional().default(""),
});

/**
 * Form schema for creating/updating payees
 */
export const PayeeFormSchema = PayeeSchema.omit({
  id: true,
  date_added: true,
});

/**
 * TypeScript types
 */
export type Payee = z.infer<typeof PayeeSchema>;
export type PayeeFormValues = z.infer<typeof PayeeFormSchema>;

/**
 * API Response type
 */
export interface PayeesResponse {
  data: Payee[];
}
