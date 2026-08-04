import React, { createContext, useContext, useMemo, useState } from 'react';
import type { PeriodView } from '../lib/analytics';
import { getSettingsSync } from '../lib/settings';

type PeriodState = {
  view: PeriodView;
  year: number;
  month: number; // 0-11
  day: number; // 1-31
  setView: (v: PeriodView) => void;
  setYear: (y: number) => void;
  setMonth: (m: number) => void;
  setDay: (d: number) => void;
};

const Ctx = createContext<PeriodState | null>(null);

export function PeriodProvider({ children }: { children: React.ReactNode }) {
  const now = new Date();
  // Seed from the space's saved default period (cache is warmed at login /
  // bootstrap, before this provider mounts).
  const [view, setView] = useState<PeriodView>(() => getSettingsSync().defaultPeriod);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [day, setDay] = useState(now.getDate());

  const value = useMemo(
    () => ({ view, year, month, day, setView, setYear, setMonth, setDay }),
    [view, year, month, day],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePeriod(): PeriodState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('usePeriod must be used within PeriodProvider');
  return ctx;
}
