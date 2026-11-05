import { z } from "zod";

export const BankSchema = z.object({
  id: z.number().optional(),
  bank_name: z.string().min(1, "Bank name is required"),
});

export type Bank = z.infer<typeof BankSchema>;

export type BankCreateInput = Omit<Bank, "id">;
