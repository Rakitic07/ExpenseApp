import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { getCurrencyCode, setCurrencyCode } from './storage';

export type Currency = { code: string; symbol: string; label: string; locale: string };

export const CURRENCIES: Currency[] = [
  { code: 'INR', symbol: '₹', label: 'Indian Rupee', locale: 'en-IN' },
  { code: 'USD', symbol: '$', label: 'US Dollar', locale: 'en-US' },
  { code: 'EUR', symbol: '€', label: 'Euro', locale: 'de-DE' },
  { code: 'GBP', symbol: '£', label: 'British Pound', locale: 'en-GB' },
  { code: 'JPY', symbol: '¥', label: 'Japanese Yen', locale: 'ja-JP' },
  { code: 'AUD', symbol: 'A$', label: 'Australian Dollar', locale: 'en-AU' },
  { code: 'CAD', symbol: 'C$', label: 'Canadian Dollar', locale: 'en-CA' },
  { code: 'SGD', symbol: 'S$', label: 'Singapore Dollar', locale: 'en-SG' },
  { code: 'AED', symbol: 'د.إ', label: 'UAE Dirham', locale: 'en-AE' },
  { code: 'CHF', symbol: 'CHF', label: 'Swiss Franc', locale: 'de-CH' },
  { code: 'CNY', symbol: '¥', label: 'Chinese Yuan', locale: 'zh-CN' },
];

const DEFAULT = CURRENCIES[0];

export function currencyMeta(code: string): Currency {
  return CURRENCIES.find(c => c.code === code) ?? DEFAULT;
}

function formatWith(cur: Currency, v: number): string {
  try {
    return new Intl.NumberFormat(cur.locale, {
      style: 'currency',
      currency: cur.code,
      maximumFractionDigits: v % 1 === 0 ? 0 : 2,
    }).format(v);
  } catch {
    return `${cur.symbol}${v.toFixed(2)}`;
  }
}

type Ctx = {
  currency: Currency;
  setCurrency: (code: string) => void;
  format: (value: number) => string;
};

const CurrencyContext = createContext<Ctx | null>(null);

export function CurrencyProvider({
  space,
  children,
}: {
  space: string;
  children: React.ReactNode;
}) {
  const [code, setCode] = useState<string>(DEFAULT.code);

  useEffect(() => {
    let alive = true;
    if (!space) {
      setCode(DEFAULT.code);
      return;
    }
    getCurrencyCode(space).then(saved => {
      if (!alive) return;
      setCode(saved && currencyMeta(saved).code === saved ? saved : DEFAULT.code);
    });
    return () => {
      alive = false;
    };
  }, [space]);

  const setCurrency = useCallback(
    (next: string) => {
      setCode(next);
      if (space) void setCurrencyCode(space, next);
    },
    [space],
  );

  const value = useMemo<Ctx>(() => {
    const cur = currencyMeta(code);
    return { currency: cur, setCurrency, format: (v: number) => formatWith(cur, v) };
  }, [code, setCurrency]);

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency(): Ctx {
  const ctx = useContext(CurrencyContext);
  if (ctx) return ctx;
  return {
    currency: DEFAULT,
    setCurrency: () => {},
    format: (v: number) => formatWith(DEFAULT, v),
  };
}
