import type { Expense, ExpenseDraft } from "./types";

async function handle<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error ?? "Something went wrong");
  }
  return data as T;
}

export const api = {
  async me() {
    const res = await fetch("/api/auth/me", { cache: "no-store" });
    return handle<{ authenticated: boolean; name?: string }>(res);
  },

  // Auth state + expenses in a single round trip (used on app startup).
  async bootstrap() {
    const res = await fetch("/api/bootstrap", { cache: "no-store" });
    return handle<{ authenticated: boolean; name?: string; expenses?: Expense[] }>(res);
  },

  async register(name: string, passphrase: string) {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, passphrase }),
    });
    return handle<{ name: string }>(res);
  },

  async login(name: string, passphrase: string) {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, passphrase }),
    });
    return handle<{ name: string }>(res);
  },

  async logout() {
    await fetch("/api/auth/logout", { method: "POST" });
  },

  async listExpenses() {
    const res = await fetch("/api/expenses", { cache: "no-store" });
    return handle<{ expenses: Expense[] }>(res);
  },

  async createExpense(draft: ExpenseDraft) {
    const res = await fetch("/api/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });
    return handle<{ expense: Expense }>(res);
  },

  async updateExpense(id: string, draft: ExpenseDraft) {
    const res = await fetch(`/api/expenses/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });
    return handle<{ expense: Expense }>(res);
  },

  async deleteExpense(id: string) {
    const res = await fetch(`/api/expenses/${id}`, { method: "DELETE" });
    return handle<{ ok: boolean }>(res);
  },
};
