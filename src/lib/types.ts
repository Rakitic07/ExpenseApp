export type Expense = {
  id: string;
  title: string;
  category: string;
  amount: number;
  paidBy: string;
  date: string; // ISO string
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ExpenseDraft = {
  title: string;
  category: string;
  amount: number;
  paidBy: string;
  date: string; // YYYY-MM-DD
  notes?: string;
};
