// import { z } from "zod";

// export const assetFormSchema = z.object({
//   item_name: z.string().min(1, "Required"),
//   item_type: z.string().min(1, "Required"),
//   item_classification: z.string().min(1, "Required"),
//   barcode: z.string().optional(),
//   rfid_code: z.string().optional(),
//   condition: z.enum(["Good", "Bad", "Under Maintenance", "Discontinued"]),
//   quantity: z.coerce.number().min(1),
//   cost_per_item: z.coerce.number().min(0),
//   life_span: z.coerce.number().min(1),
//   date_acquired: z.date(),
//   department: z.coerce.number(),
//   employee: z.coerce.number().optional(),
//   item_image: z.any().optional(),
// });

// export type AssetFormValues = z.infer<typeof assetFormSchema>;

// export interface Department {
//   department_id: number;
//   department_description: string;
// }

// export interface User {
//   user_id: number;
//   user_fname: string;
//   user_mname?: string; // Optional middle name
//   user_lname: string;
// }

// export interface AssetTableData {
//   id: number;
//   barcode: string | null;
//   rfid_code: string | null;
//   condition: "Good" | "Bad" | "Under Maintenance" | "Discontinued";
//   quantity: number;
//   cost_per_item: number;
//   total: number;
//   date_acquired: string;

//   // These are the virtual fields we create in our GET route
//   item_name: string;
//   item_type_name: string;
//   item_class_name: string;
//   department_name: string;
//   assigned_to_name: string;

//   // Keep the raw IDs in case you need them for Edit/Delete actions
//   item_id: number;
//   department: number | null;
//   employee: number | null;
//   encoder: number | null;
// }

import { z } from "zod";

// --- 1. Base Schemas ---

export const departmentSchema = z.object({
  department_id: z.number(),
  department_name: z.string(), // Matches your UI mapping
});

export const userSchema = z.object({
  user_id: z.number(),
  user_fname: z.string(),
  user_mname: z.string().optional().nullable(),
  user_lname: z.string(),
});

// --- 2. Form Schema (Keep as is, but sync types) ---

export const assetFormSchema = z.object({
  item_name: z.string().min(1, "Required"),
  item_type: z.string().min(1, "Required"),
  item_classification: z.string().min(1, "Required"),
  barcode: z.string().optional(),
  rfid_code: z.string().optional(),
  condition: z.enum(["Good", "Bad", "Under Maintenance", "Discontinued"]),
  quantity: z.coerce.number().min(1),
  cost_per_item: z.coerce.number().min(0),
  life_span: z.coerce.number().min(1),
  date_acquired: z.date(), // Form uses Date object
  department: z.coerce.number(),
  employee: z.coerce.number().optional(),
  item_image: z.any().optional(),
});

// --- 3. Table Schema (For API Responses) ---

export const assetTableDataSchema = z.object({
  id: z.number(),
  barcode: z.string().nullable(),
  rfid_code: z.string().nullable(),
  condition: z.enum(["Good", "Bad", "Under Maintenance", "Discontinued"]),
  quantity: z.number(),
  cost_per_item: z.number(),
  total: z.number(),
  date_acquired: z.string(), // API usually returns a string date

  // Virtual fields from the JOINs
  item_name: z.string(),
  item_type_name: z.string(),
  item_class_name: z.string(),
  department_name: z.string(),
  assigned_to_name: z.string(),

  // Raw IDs
  item_id: z.number(),
  department: z.number().nullable(),
  employee: z.number().nullable(),
  encoder: z.number().nullable(),
});

// --- 4. Exported Types ---

export type Department = z.infer<typeof departmentSchema>;
export type User = z.infer<typeof userSchema>;
export type AssetFormValues = z.infer<typeof assetFormSchema>;
export type AssetTableData = z.infer<typeof assetTableDataSchema>;
