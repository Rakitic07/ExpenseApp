import { API_BASE } from '../config';
import type { Expense, ExpenseDraft } from './types';
import { getTokenSync, setToken } from './storage';

async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const url = /^https?:\/\//.test(path) ? path : API_BASE + path;
  const headers = new Headers(init.headers);
  const token = getTokenSync();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return fetch(url, { ...init, headers, credentials: 'omit' });
}

async function handle<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error ?? 'Something went wrong');
  }
  return data as T;
}

export const api = {
  async bootstrap() {
    const res = await apiFetch('/api/bootstrap');
    return handle<{
      authenticated: boolean;
      name?: string;
      budget?: number | null;
      expenses?: Expense[];
    }>(res);
  },

  async me() {
    const res = await apiFetch('/api/auth/me');
    return handle<{ authenticated: boolean; name?: string }>(res);
  },

  async getBudget() {
    const res = await apiFetch('/api/budget');
    return handle<{ budget: number | null }>(res);
  },

  async setBudget(budget: number | null) {
    const res = await apiFetch('/api/budget', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ budget }),
    });
    return handle<{ budget: number | null }>(res);
  },

  async register(name: string, passphrase: string) {
    const res = await apiFetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, passphrase }),
    });
    const data = await handle<{ name: string; recoveryCode: string; token?: string }>(res);
    if (data.token) await setToken(data.token);
    return data;
  },

  async recover(name: string, recoveryCode: string, passphrase: string) {
    const res = await apiFetch('/api/auth/recover', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, recoveryCode, passphrase }),
    });
    return handle<{ name: string; recoveryCode: string }>(res);
  },

  async findSpace(query: string, passphrase?: string) {
    const res = await apiFetch('/api/auth/find-space', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, passphrase }),
    });
    return handle<{ matches: string[] }>(res);
  },

  async login(name: string, passphrase: string) {
    const res = await apiFetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, passphrase }),
    });
    const data = await handle<{ name: string; token?: string }>(res);
    if (data.token) await setToken(data.token);
    return data;
  },

  async logout() {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } finally {
      await setToken(null);
    }
  },

  async listExpenses() {
    const res = await apiFetch('/api/expenses');
    return handle<{ expenses: Expense[] }>(res);
  },

  async createExpense(draft: ExpenseDraft) {
    const res = await apiFetch('/api/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draft),
    });
    return handle<{ expense: Expense }>(res);
  },

  async updateExpense(id: string, draft: ExpenseDraft) {
    const res = await apiFetch(`/api/expenses/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draft),
    });
    return handle<{ expense: Expense }>(res);
  },

  async deleteExpense(id: string) {
    const res = await apiFetch(`/api/expenses/${id}`, { method: 'DELETE' });
    return handle<{ ok: boolean }>(res);
  },
};
