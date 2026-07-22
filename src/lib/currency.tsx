"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type Currency = { code: string; symbol: string; label: string; locale: string };

// A compact list of common currencies. Add more freely.
export const CURRENCIES: Currency[] = [
  { code: "INR", symbol: "₹", label: "Indian Rupee", locale: "en-IN" },
  { code: "USD", symbol: "$", label: "US Dollar", locale: "en-US" },
  { code: "EUR", symbol: "€", label: "Euro", locale: "de-DE" },
  { code: "GBP", symbol: "£", label: "British Pound", locale: "en-GB" },
  { code: "JPY", symbol: "¥", label: "Japanese Yen", locale: "ja-JP" },
  { code: "AUD", symbol: "A$", label: "Australian Dollar", locale: "en-AU" },
  { code: "CAD", symbol: "C$", label: "Canadian Dollar", locale: "en-CA" },
  { code: "SGD", symbol: "S$", label: "Singapore Dollar", locale: "en-SG" },
  { code: "AED", symbol: "د.إ", label: "UAE Dirham", locale: "en-AE" },
  { code: "CHF", symbol: "CHF", label: "Swiss Franc", locale: "de-CH" },
  { code: "CNY", symbol: "¥", label: "Chinese Yuan", locale: "zh-CN" },
];

const DEFAULT = CURRENCIES[0];

export function currencyMeta(code: string): Currency {
  return CURRENCIES.find((c) => c.code === code) ?? DEFAULT;
}

type Ctx = {
  currency: Currency;
  setCurrency: (code: string) => void;
  format: (value: number) => string;
};

const CurrencyContext = createContext<Ctx | null>(null);

function keyFor(space: string): string {
  return `spendly.currency.${space}`;
}

export function CurrencyProvider({
  space,
  children,
}: {
  space: string;
  children: React.ReactNode;
}) {
  const [code, setCode] = useState<string>(DEFAULT.code);

  useEffect(() => {
    if (!space) return;
    try {
      const saved = localStorage.getItem(keyFor(space));
      setCode(saved && currencyMeta(saved).code === saved ? saved : DEFAULT.code);
    } catch {
      setCode(DEFAULT.code);
    }
  }, [space]);

  const setCurrency = useCallback(
    (next: string) => {
      setCode(next);
      try {
        if (space) localStorage.setItem(keyFor(space), next);
      } catch {
        /* ignore storage errors */
      }
    },
    [space]
  );

  const value = useMemo<Ctx>(() => {
    const cur = currencyMeta(code);
    const format = (v: number) => {
      try {
        return new Intl.NumberFormat(cur.locale, {
          style: "currency",
          currency: cur.code,
          maximumFractionDigits: v % 1 === 0 ? 0 : 2,
        }).format(v);
      } catch {
        return `${cur.symbol}${v.toFixed(2)}`;
      }
    };
    return { currency: cur, setCurrency, format };
  }, [code, setCurrency]);

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

// Format outside of React (e.g. for toasts) using a space's saved currency.
export function formatFor(space: string, value: number): string {
  let code = DEFAULT.code;
  try {
    const saved = space ? localStorage.getItem(keyFor(space)) : null;
    if (saved && currencyMeta(saved).code === saved) code = saved;
  } catch {
    /* ignore */
  }
  const cur = currencyMeta(code);
  try {
    return new Intl.NumberFormat(cur.locale, {
      style: "currency",
      currency: cur.code,
      maximumFractionDigits: value % 1 === 0 ? 0 : 2,
    }).format(value);
  } catch {
    return `${cur.symbol}${value.toFixed(2)}`;
  }
}

export function useCurrency(): Ctx {
  const ctx = useContext(CurrencyContext);
  if (ctx) return ctx;
  // Fallback (e.g. if used outside a provider): default to INR formatting.
  const cur = DEFAULT;
  return {
    currency: cur,
    setCurrency: () => {},
    format: (v: number) =>
      new Intl.NumberFormat(cur.locale, {
        style: "currency",
        currency: cur.code,
        maximumFractionDigits: v % 1 === 0 ? 0 : 2,
      }).format(v),
  };
}
