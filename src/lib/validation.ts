import { z } from "zod";

export const authSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(40, "Name is too long"),
  passphrase: z
    .string()
    .min(6, "Passphrase must be at least 6 characters")
    .max(128, "Passphrase is too long"),
});

export const expenseSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(80),
  category: z.string().trim().min(1, "Category is required").max(40),
  amount: z
    .number({ invalid_type_error: "Amount must be a number" })
    .positive("Amount must be greater than 0")
    .max(100_000_000, "Amount is too large"),
  paidBy: z.string().trim().min(1, "Paid By is required").max(40),
  // ISO date string (YYYY-MM-DD) or full ISO datetime.
  date: z
    .string()
    .refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date"),
  notes: z.string().trim().max(280).optional().or(z.literal("")),
});

export type ExpenseInput = z.infer<typeof expenseSchema>;
export type AuthInput = z.infer<typeof authSchema>;
