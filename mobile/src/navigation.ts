import type { Expense } from './lib/types';

export type RootStackParamList = {
  Home: undefined;
  ExpenseForm: { expense?: Expense } | undefined;
};

export type TabParamList = {
  Overview: undefined;
  Charts: undefined;
  Activity: undefined;
};
