"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, Download, RefreshCw, Sparkles, Target, WalletCards, type LucideIcon } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Card, CardTitle } from "@/app/components/ui/card";
import { RevenueChart } from "@/app/components/dashboard/revenue-chart";
import { StatCard } from "@/app/components/dashboard/stat-card";
import type { ApiResult, DashboardData } from "@/app/types/studio";
import { formatDate, formatMoney } from "@/app/utils/format";
import { useUiStore } from "@/app/store/ui-store";

type ChartMode = "day" | "month" | "year";

const MIN_DASHBOARD_YEAR = 2025;
const MAX_DASHBOARD_YEAR = 2050;

const fallbackData: DashboardData = {
  summary: { totalIncome: 0, totalExpense: 0, profit: 0, unpaidDebt: 0 },
  revenue: [],
  monthly: [],
  recentTransactions: [],
  openInvoices: [],
  upcomingBookings: [],
  wallets: [],
};

const chartModeOptions: Array<{ value: ChartMode; label: string }> = [
  { value: "day", label: "Ngày" },
  { value: "month", label: "Tháng" },
  { value: "year", label: "Năm" },
];

const monthOptions = Array.from({ length: 12 }, (_, index) => ({ value: index + 1, label: `Tháng ${index + 1}` }));

type Insight = {
  prediction: { nextMonthRevenue: number; confidence: string };
  suggestions: string[];
};

export function DashboardView() {
  const [dashboard, setDashboard] = useState<DashboardData>(fallbackData);
  const [insight, setInsight] = useState<Insight | null>(null);
  const session = useUiStore((state) => state.session);
  const [loading, setLoading] = useState(false);
  const [chartMode, setChartMode] = useState<ChartMode>("month");
  const currentYear = Math.min(MAX_DASHBOARD_YEAR, Math.max(MIN_DASHBOARD_YEAR, new Date().getFullYear()));
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [fromYear, setFromYear] = useState(MIN_DASHBOARD_YEAR);
  const [toYear, setToYear] = useState(currentYear);
  const isStaff = session?.user.role === "STAFF";

  const chartData = dashboard.revenue.length > 0 ? dashboard.revenue : dashboard.monthly;

  const yearOptions = useMemo(() => {
    return Array.from({ length: MAX_DASHBOARD_YEAR - MIN_DASHBOARD_YEAR + 1 }, (_, index) => MAX_DASHBOARD_YEAR - index);
  }, []);

  const chartRangeLabel = useMemo(() => {
    if (chartMode === "day") return `Tháng ${selectedMonth}/${selectedYear}`;
    if (chartMode === "month") return `Năm ${selectedYear}`;
    return `${Math.min(fromYear, toYear)} - ${Math.max(fromYear, toYear)}`;
  }, [chartMode, fromYear, selectedMonth, selectedYear, toYear]);

  const pulse = useMemo(() => {
    const income = dashboard.summary.totalIncome;
    const expense = dashboard.summary.totalExpense;
    const profit = dashboard.summary.profit;
    const margin = income > 0 ? Math.round((profit / income) * 100) : 0;
    const cashFlowText = profit >= 0 ? "Dòng tiền đang dương" : "Dòng tiền đang âm";
    const debtText = dashboard.summary.unpaidDebt > 0 ? `Còn công nợ ${formatMoney(dashboard.summary.unpaidDebt)}` : "Không có công nợ mở";
    const bookingText = dashboard.upcomingBookings.length > 0 ? `${dashboard.upcomingBookings.length} lịch sắp tới` : "Chưa có lịch sắp tới";
    const expenseText = income > 0 ? `Chiếm ${Math.round((expense / income) * 100)}% doanh thu` : "Chưa có doanh thu để so sánh";

    return { margin, cashFlowText, debtText, bookingText, expenseText };
  }, [dashboard]);

  const loadData = useCallback(async (mode: ChartMode = chartMode) => {
    setLoading(true);
    const params = new URLSearchParams({
      chartMode: mode,
      month: String(selectedMonth),
      year: String(selectedYear),
      fromYear: String(Math.min(fromYear, toYear)),
      toYear: String(Math.max(fromYear, toYear)),
    });
    const [dashboardRes, insightRes] = await Promise.all([
      fetch(`/api/dashboard?${params.toString()}`).then((res) => res.json() as Promise<ApiResult<DashboardData>>).catch(() => null),
      fetch("/api/ai/insights").then((res) => res.json() as Promise<ApiResult<Insight>>).catch(() => null),
    ]);
    if (dashboardRes?.data) setDashboard(dashboardRes.data);
    if (insightRes?.data) setInsight(insightRes.data);
    setLoading(false);
  }, [chartMode, fromYear, selectedMonth, selectedYear, toYear]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadData(chartMode), 0);
    return () => window.clearTimeout(timer);
  }, [chartMode, loadData, selectedMonth, selectedYear, fromYear, toYear]);

  return (
    <div className="mx-auto max-w-[1500px] space-y-4 sm:space-y-5">
      <section className="rounded-[1.5rem] border border-[#F7C4CA] bg-[#FFF8F1] p-4 shadow-[0_18px_50px_rgba(184,95,108,0.12)] sm:rounded-[2rem] sm:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#E88498] sm:text-sm">Tổng quan</p>
            <h1 className="mt-1 text-2xl font-black text-[#5B342C] sm:text-3xl">{isStaff ? "Lịch làm việc" : "Số liệu studio"}</h1>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
            {!isStaff ? (
              <div className="rounded-[1.35rem] border border-[#F7C4CA] bg-white/95 p-2 shadow-[0_12px_30px_rgba(184,95,108,0.12)]">
                <div className="grid grid-cols-3 gap-1 rounded-[1.1rem] bg-[#FFF3EC] p-1">
                  {chartModeOptions.map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => setChartMode(item.value)}
                      className={`min-h-12 rounded-xl px-3 py-2 text-sm font-black transition sm:px-5 ${
                        chartMode === item.value ? "bg-[#EA7188] text-white shadow-sm" : "text-[#9B746B] hover:bg-[#FFF3EC]"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                <div className="mt-2 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                  {chartMode === "day" ? (
                    <select className="min-h-12 rounded-2xl border border-[#F7C4CA] bg-white px-3 text-sm font-black text-[#5B342C] shadow-sm outline-none transition focus:border-[#EA7188] focus:ring-2 focus:ring-[#FFE4EA]" value={selectedMonth} onChange={(event) => setSelectedMonth(Number(event.target.value))}>
                      {monthOptions.map((item) => (
                        <option key={item.value} value={item.value}>{item.label}</option>
                      ))}
                    </select>
                  ) : null}

                  {chartMode !== "year" ? (
                    <select className="min-h-12 rounded-2xl border border-[#F7C4CA] bg-white px-3 text-sm font-black text-[#5B342C] shadow-sm outline-none transition focus:border-[#EA7188] focus:ring-2 focus:ring-[#FFE4EA]" value={selectedYear} onChange={(event) => setSelectedYear(Number(event.target.value))}>
                      {yearOptions.map((year) => (
                        <option key={year} value={year}>{year}</option>
                      ))}
                    </select>
                  ) : (
                    <>
                      <select className="min-h-12 rounded-2xl border border-[#F7C4CA] bg-white px-3 text-sm font-black text-[#5B342C] shadow-sm outline-none transition focus:border-[#EA7188] focus:ring-2 focus:ring-[#FFE4EA]" value={fromYear} onChange={(event) => setFromYear(Number(event.target.value))}>
                        {yearOptions.map((year) => (
                          <option key={year} value={year}>Từ {year}</option>
                        ))}
                      </select>
                      <select className="min-h-12 rounded-2xl border border-[#F7C4CA] bg-white px-3 text-sm font-black text-[#5B342C] shadow-sm outline-none transition focus:border-[#EA7188] focus:ring-2 focus:ring-[#FFE4EA]" value={toYear} onChange={(event) => setToYear(Number(event.target.value))}>
                        {yearOptions.map((year) => (
                          <option key={year} value={year}>Đến {year}</option>
                        ))}
                      </select>
                    </>
                  )}
                </div>
              </div>
            ) : null}
            <Button className="min-h-11 sm:w-auto" variant="secondary" onClick={() => void loadData(chartMode)}>
              <RefreshCw size={17} className={loading ? "animate-spin" : ""} />
              Làm mới
            </Button>
            {!isStaff ? (
              <a href="/api/reports?type=transactions">
                <Button className="min-h-11 w-full sm:w-auto">
                  <Download size={17} />
                  CSV
                </Button>
              </a>
            ) : null}
          </div>
        </div>
      </section>

      {!isStaff ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            <StatCard label="Tổng thu" value={dashboard.summary.totalIncome} tone="income" />
            <StatCard label="Tổng chi" value={dashboard.summary.totalExpense} tone="expense" />
            <StatCard label="Lợi nhuận" value={dashboard.summary.profit} tone="profit" />
            <StatCard label="Công nợ" value={dashboard.summary.unpaidDebt} tone="debt" />
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.7fr_1fr]">
            <RevenueChart data={chartData} mode={chartMode} rangeLabel={chartRangeLabel} />
            <Card className="overflow-hidden">
              <div className="mb-4 flex items-center gap-2 sm:mb-5">
                <Sparkles className="text-[#EA7188]" size={20} />
                <CardTitle>Điểm nổi bật hôm nay</CardTitle>
              </div>
              <div className="rounded-[1.5rem] bg-[#FFF3EC] p-4">
                <p className="text-sm font-bold text-[#9B746B]">Biên lợi nhuận</p>
                <p className="mt-1 text-3xl font-black text-violet-700 sm:text-4xl">{pulse.margin}%</p>
                <p className="mt-2 text-sm font-semibold text-[#5B342C]">{pulse.cashFlowText}</p>
              </div>
              <div className="mt-4 grid gap-3">
                <PulseItem icon={WalletCards} title={pulse.debtText} desc={pulse.expenseText} />
                <PulseItem icon={CalendarDays} title={pulse.bookingText} desc="Ưu tiên chuẩn bị ekip, thiết bị và nhắc lịch khách." />
                <PulseItem icon={Target} title="Việc nên làm" desc={insight?.suggestions?.[0] ?? "Chưa đủ dữ liệu để gợi ý."} />
              </div>
            </Card>
          </div>
        </>
      ) : null}

      {isStaff ? (
        <Card>
          <div className="mb-4 flex items-center gap-2">
            <CalendarDays size={18} className="text-[#EA7188]" />
            <CardTitle>Lịch sắp tới</CardTitle>
          </div>
          <div className="space-y-3">
            {dashboard.upcomingBookings.length === 0 ? <p className="text-sm font-semibold text-[#9B746B]">Chưa có booking.</p> : null}
            {dashboard.upcomingBookings.map((item, index) => (
              <div key={String(item.id ?? index)} className="rounded-2xl bg-[#FFF3EC] p-3">
                <p className="whitespace-normal break-words text-sm font-black leading-5 text-[#5B342C]">{String(item.title ?? "")}</p>
                <p className="text-xs font-semibold text-[#9B746B]">{formatDate(item.startAt as string | Date)}</p>
              </div>
            ))}
          </div>
        </Card>
      ) : null}
    </div>
  );
}

function PulseItem({ icon: Icon, title, desc }: { icon: LucideIcon; title: string; desc: string }) {
  return (
    <div className="flex gap-3 rounded-[1.25rem] border border-[#F4C7C4] bg-white p-3">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#FFE4EA] text-[#EA7188]">
        <Icon size={18} />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-black text-[#5B342C]">{title}</p>
        <p className="mt-1 text-xs font-semibold leading-5 text-[#9B746B]">{desc}</p>
      </div>
    </div>
  );
}
