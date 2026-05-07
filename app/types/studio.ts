export type RevenuePoint = {
  label: string;
  income: number;
  expense: number;
  profit: number;
};

export type DashboardData = {
  summary: {
    totalIncome: number;
    totalExpense: number;
    profit: number;
    unpaidDebt: number;
  };
  revenue: RevenuePoint[];
  monthly: RevenuePoint[];
  recentTransactions: Array<Record<string, unknown>>;
  openInvoices: Array<Record<string, unknown>>;
  upcomingBookings: Array<Record<string, unknown>>;
  wallets: Array<Record<string, unknown>>;
};

export type ApiResult<T> = { data?: T; error?: { message: string } };
