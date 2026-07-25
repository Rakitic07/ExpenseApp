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

  // Auth state + budget + expenses in a single round trip (used on app startup).
  async bootstrap() {
    const res = await fetch("/api/bootstrap", { cache: "no-store" });
    return handle<{
      authenticated: boolean;
      name?: string;
      budget?: number | null;
      expenses?: Expense[];
    }>(res);
  },

  async getBudget() {
    const res = await fetch("/api/budget", { cache: "no-store" });
    return handle<{ budget: number | null }>(res);
  },

  async setBudget(budget: number | null) {
    const res = await fetch("/api/budget", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ budget }),
    });
    return handle<{ budget: number | null }>(res);
  },

  async register(name: string, passphrase: string) {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, passphrase }),
    });
    return handle<{ name: string; recoveryCode: string }>(res);
  },

  // Self-service reset using the recovery code shown at signup. Returns a fresh
  // recovery code (the old one is single-use).
  async recover(name: string, recoveryCode: string, passphrase: string) {
    const res = await fetch("/api/auth/recover", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, recoveryCode, passphrase }),
    });
    return handle<{ name: string; recoveryCode: string }>(res);
  },

  // Ask an admin to approve a reset. Returns a ticket code to check status with.
  async requestReset(
    name: string,
    passphrase: string,
    questionnaire: Record<string, string>
  ) {
    const res = await fetch("/api/auth/reset-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, passphrase, questionnaire }),
    });
    return handle<{ ticket: string }>(res);
  },

  async resetStatus(name: string, ticket: string) {
    const res = await fetch("/api/auth/reset-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, ticket }),
    });
    return handle<{ status: "pending" | "approved" | "rejected" | "notfound"; resolvedAt?: string | null }>(res);
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
