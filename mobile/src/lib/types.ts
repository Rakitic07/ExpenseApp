export type Expense = {
  id: string;
  title: string;
  category: string;
  amount: number;
  paidBy: string;
  date: string; // ISO string
  notes: string | null;
  paymentMode: string | null; // Cash | UPI | Card
  paymentDetail: string | null; // provider/bank, e.g. "Google Pay", "HDFC"
  // Tiny base64 JPEG data URL of a scanned bill (preview only), or null.
  thumbnail?: string | null;
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
  paymentMode?: string;
  paymentDetail?: string;
  thumbnail?: string; // base64 JPEG data URL, capped ~10KB
};
