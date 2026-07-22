"use client";

import { Coins } from "lucide-react";
import { CURRENCIES, useCurrency } from "@/lib/currency";

export default function CurrencySelect() {
  const { currency, setCurrency } = useCurrency();

  return (
    <label
      className="glass-btn shrink-0 cursor-pointer gap-1.5 px-2.5 py-2.5 sm:px-3"
      title="Currency for this space"
    >
      <Coins className="h-4 w-4 shrink-0 text-[#ffd43b]" />
      {/*
       * Native selects render the *selected option's* text when closed, so we
       * keep the option labels short (symbol + code) to stop the control from
       * growing wide and pushing the Add/Logout buttons off small screens.
       */}
      <select
        value={currency.code}
        onChange={(e) => setCurrency(e.target.value)}
        aria-label="Select currency"
        className="w-[3.75rem] cursor-pointer appearance-none bg-transparent text-sm font-medium text-white outline-none"
      >
        {CURRENCIES.map((c) => (
          <option key={c.code} value={c.code} className="bg-[#0b1030] text-white">
            {c.symbol} {c.code}
          </option>
        ))}
      </select>
    </label>
  );
}
