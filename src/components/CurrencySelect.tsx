"use client";

import { Coins } from "lucide-react";
import { CURRENCIES, useCurrency } from "@/lib/currency";

export default function CurrencySelect() {
  const { currency, setCurrency } = useCurrency();

  return (
    <label
      className="glass-btn cursor-pointer gap-1.5 px-3 py-2.5"
      title="Currency for this space"
    >
      <Coins className="h-4 w-4 text-[#ffd43b]" />
      <span className="text-sm font-medium">{currency.symbol}</span>
      <select
        value={currency.code}
        onChange={(e) => setCurrency(e.target.value)}
        aria-label="Select currency"
        className="cursor-pointer appearance-none bg-transparent text-sm font-medium text-white outline-none"
      >
        {CURRENCIES.map((c) => (
          <option key={c.code} value={c.code} className="bg-[#0b1030] text-white">
            {c.code} · {c.symbol} — {c.label}
          </option>
        ))}
      </select>
    </label>
  );
}
