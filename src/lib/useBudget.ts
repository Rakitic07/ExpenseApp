"use client";

import { useCallback, useEffect, useState } from "react";

// A recurring monthly budget, stored client-side per space. It's a personal
// goal (not sensitive), so localStorage keeps it simple and DB-free.
function keyFor(space: string): string {
  return `spendly.budget.${space}`;
}

export function useBudget(space: string): {
  budget: number | null;
  setBudget: (value: number | null) => void;
} {
  const [budget, setBudgetState] = useState<number | null>(null);

  useEffect(() => {
    if (!space) return;
    try {
      const raw = localStorage.getItem(keyFor(space));
      setBudgetState(raw ? Number(raw) || null : null);
    } catch {
      setBudgetState(null);
    }
  }, [space]);

  const setBudget = useCallback(
    (value: number | null) => {
      setBudgetState(value);
      try {
        if (value && value > 0) localStorage.setItem(keyFor(space), String(value));
        else localStorage.removeItem(keyFor(space));
      } catch {
        /* ignore storage errors */
      }
    },
    [space]
  );

  return { budget, setBudget };
}
