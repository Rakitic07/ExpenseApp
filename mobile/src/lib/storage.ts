import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Expense } from './types';

// -- Auth token -------------------------------------------------------------
// The native app authenticates with a Bearer token (signed JWT from the
// backend). We keep an in-memory copy so api.ts can attach it synchronously,
// and persist it to AsyncStorage so it survives restarts.

const TOKEN_KEY = 'spendly_token';
let tokenCache: string | null = null;

export async function loadToken(): Promise<string | null> {
  try {
    tokenCache = await AsyncStorage.getItem(TOKEN_KEY);
  } catch {
    tokenCache = null;
  }
  return tokenCache;
}

export function getTokenSync(): string | null {
  return tokenCache;
}

export async function setToken(token: string | null): Promise<void> {
  tokenCache = token;
  try {
    if (token) await AsyncStorage.setItem(TOKEN_KEY, token);
    else await AsyncStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore storage errors */
  }
}

// -- Last space + currency --------------------------------------------------

const LAST_SPACE_KEY = 'spendly_last_space';

export async function getLastSpace(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(LAST_SPACE_KEY);
  } catch {
    return null;
  }
}

export async function setLastSpace(space: string | null): Promise<void> {
  try {
    if (space) await AsyncStorage.setItem(LAST_SPACE_KEY, space);
    else await AsyncStorage.removeItem(LAST_SPACE_KEY);
  } catch {
    /* ignore */
  }
}

function currencyKey(space: string): string {
  return `spendly.currency.${space}`;
}

export async function getCurrencyCode(space: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(currencyKey(space));
  } catch {
    return null;
  }
}

export async function setCurrencyCode(space: string, code: string): Promise<void> {
  try {
    await AsyncStorage.setItem(currencyKey(space), code);
  } catch {
    /* ignore */
  }
}

// -- Expense cache (offline-first) ------------------------------------------

function cacheKey(space: string): string {
  return `spendly.cache.${space}`;
}

export async function readCache(space: string): Promise<Expense[]> {
  try {
    const raw = await AsyncStorage.getItem(cacheKey(space));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Expense[]) : [];
  } catch {
    return [];
  }
}

export async function writeCache(space: string, expenses: Expense[]): Promise<void> {
  try {
    await AsyncStorage.setItem(cacheKey(space), JSON.stringify(expenses));
  } catch {
    /* ignore */
  }
}

// -- Budget cache -----------------------------------------------------------

function budgetKey(space: string): string {
  return `spendly.budget.${space}`;
}

export async function readBudgetCache(space: string): Promise<number | null> {
  try {
    const raw = await AsyncStorage.getItem(budgetKey(space));
    if (raw == null) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

export async function writeBudgetCache(space: string, budget: number | null): Promise<void> {
  try {
    if (budget == null) await AsyncStorage.removeItem(budgetKey(space));
    else await AsyncStorage.setItem(budgetKey(space), String(budget));
  } catch {
    /* ignore */
  }
}
