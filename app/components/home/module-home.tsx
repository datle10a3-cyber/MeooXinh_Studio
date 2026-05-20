"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  BadgeDollarSign,
  BarChart3,
  BriefcaseBusiness,
  CalendarDays,
  FileText,
  FolderOpen,
  Package,
  Sparkles,
  Users,
  WalletCards,
} from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { StudioCatMark } from "@/app/components/brand/studio-brand";
import { Card, CardTitle } from "@/app/components/ui/card";
import { cachedFetch } from "@/app/lib/cached-fetch";
import { useUiStore } from "@/app/store/ui-store";
import type { DashboardData } from "@/app/types/studio";
import { formatDate, formatMoney } from "@/app/utils/format";
import { navigateStudioView } from "@/app/utils/studio-navigation";

const flow = [
  { title: "Danh mục", id: "categories", href: "/categories", icon: FolderOpen },
  { title: "Gói", id: "packages", href: "/packages", icon: Package },
  { title: "Booking", id: "booking", href: "/booking", icon: CalendarDays },
  { title: "Dự án", id: "projects", icon: BriefcaseBusiness },
  { title: "Hóa đơn", id: "invoices", icon: FileText },
  { title: "Thu chi", id: "transactions", icon: BadgeDollarSign },
];

const quick = [
  { title: "Khách", id: "customers", icon: Users },
  { title: "Ví", id: "wallets", icon: WalletCards },
  { title: "Dashboard", id: "dashboard", icon: BarChart3 },
  { title: "AI", id: "ai", icon: Sparkles },
];

const fallbackDashboard: DashboardData = {
  summary: { totalIncome: 0, totalExpense: 0, profit: 0, unpaidDebt: 0 },
  revenue: [],
  monthly: [],
  recentTransactions: [],
  openInvoices: [],
  upcomingBookings: [],
  wallets: [],
};

function bookingGroupName(note?: string | null) {
  const match = String(note ?? "").match(/Loại booking:\s*Booking nhóm(?:\s*-\s*([^\n.]+))?/i);
  return match ? (match[1]?.trim() || "Booking nhóm") : null;
}

function upcomingBookingTitle(item: Record<string, unknown>) {
  const groupName = bookingGroupName(item.note as string);
  const customerName = String(item.customerName ?? "").trim();
  const packageName = String(item.packageName ?? "").trim();
  
  if (groupName) {
    const base = customerName && packageName ? `${customerName} · ${packageName}` : String(item.title ?? customerName ?? packageName ?? "Booking");
    return `[Nhóm: ${groupName}] ${base}`;
  }
  
  if (customerName && packageName) return `${customerName} · ${packageName}`;
  return String(item.title ?? customerName ?? packageName ?? "Booking sắp tới");
}

function upcomingBookingTime(item: Record<string, unknown>) {
  const value = item.startAt ?? item.startTime ?? item.createdAt;
  return value ? formatDate(value as string | Date) : "Chưa có thời gian";
}

function upcomingBookingBadge(item: Record<string, unknown>) {
  const raw = item.startAt ?? item.startTime;
  const date = raw ? new Date(String(raw)) : null;
  let timeStatus = "Sắp tới";
  
  if (date && !Number.isNaN(date.getTime())) {
    const today = new Date();
    const sameDay = date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth() && date.getDate() === today.getDate();
    if (sameDay) timeStatus = "Hôm nay";
  }
  
  const groupName = bookingGroupName(item.note as string);
  return groupName ? `Nhóm · ${timeStatus}` : `Cá nhân · ${timeStatus}`;
}

function rowTimeValue(item: Record<string, unknown>, fields: string[]) {
  for (const field of fields) {
    const raw = item[field];
    if (!raw) continue;
    const time = new Date(String(raw)).getTime();
    if (!Number.isNaN(time)) return time;
  }
  return 0;
}

export function ModuleHome() {
  const setActiveResource = useUiStore((state) => state.setActiveResource);
  const setFocusedItemId = useUiStore((state) => state.setFocusedItemId);
  const setTransactionViewIntent = useUiStore((state) => state.setTransactionViewIntent);
  const router = useRouter();
  const pathname = usePathname();
  const [dashboard, setDashboard] = useState<DashboardData>(fallbackDashboard);
  const [showAllBookings, setShowAllBookings] = useState(false);
  const [showAllTransactions, setShowAllTransactions] = useState(false);
  const previewLimit = 5;

  function goToResource(id: string) {
    setActiveResource(id);
    setFocusedItemId(null);
    setTransactionViewIntent(null);
    navigateStudioView(router, pathname, id);
  }

  function goToBooking(item: Record<string, unknown>) {
    const id = String(item.id ?? "");
    setActiveResource("booking");
    setTransactionViewIntent(null);
    if (id) setFocusedItemId(id);
    router.push("/booking", { scroll: true });
  }

  function goToTransaction(item: Record<string, unknown>) {
    const id = String(item.id ?? "");
    const type = String(item.type ?? "");
    const view = type === "EXPENSE" ? "expense" : "income";
    setActiveResource("transactions");
    setTransactionViewIntent(view);
    if (id) setFocusedItemId(id);
    navigateStudioView(router, pathname, "transactions", { tab: view });
  }

  useEffect(() => {
    let cancelled = false;
    cachedFetch<DashboardData>("/api/dashboard?chartMode=month", { staleTime: 30_000 })
      .then((data) => {
        if (cancelled || !data) return;
        // Chuẩn hóa dữ liệu để tránh lỗi render nếu API trả về thiếu field
        const normalized: DashboardData = {
          summary: data.summary || fallbackDashboard.summary,
          revenue: Array.isArray(data.revenue) ? data.revenue : [],
          monthly: Array.isArray(data.monthly) ? data.monthly : [],
          recentTransactions: Array.isArray(data.recentTransactions) ? data.recentTransactions : [],
          openInvoices: Array.isArray(data.openInvoices) ? data.openInvoices : [],
          upcomingBookings: Array.isArray(data.upcomingBookings) ? data.upcomingBookings : [],
          wallets: Array.isArray(data.wallets) ? data.wallets : [],
        };
        setDashboard(normalized);
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setMounted(true), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const displayBookings = useMemo(() => {
    const raw = dashboard?.upcomingBookings || [];
    const final: Record<string, unknown>[] = [];
    const groups = new Map<string, Record<string, unknown>[]>();
    
    for (const item of raw) {
      const gName = bookingGroupName(item.note as string);
      const dateKey = String(item.startAt ?? item.startTime ?? "").substring(0, 13);
      const key = gName ? `${gName.toLowerCase().trim()}_${dateKey}` : null;
      
      if (key) {
        const arr = groups.get(key) || [];
        arr.push(item);
        groups.set(key, arr);
      } else {
        final.push(item);
      }
    }
    
    for (const rows of Array.from(groups.values())) {
      if (rows.length === 1) {
        final.push(rows[0]);
        continue;
      }
      const first = rows[0];
      const names = rows.map(r => String(r.customerName ?? "").trim()).filter(Boolean);
      const customerNamesJoined = [...new Set(names)].join(", ");
      
      final.push({
        ...first,
        customerName: customerNamesJoined,
        _isGroupRep: true,
      });
    }
    
    return final.sort((a, b) => {
      const tA = rowTimeValue(a, ["startAt", "startTime", "createdAt"]);
      const tB = rowTimeValue(b, ["startAt", "startTime", "createdAt"]);
      if (tA !== tB) return tB - tA;
      return rowTimeValue(b, ["createdAt"]) - rowTimeValue(a, ["createdAt"]);
    });
  }, [dashboard?.upcomingBookings]);

  const displayTransactions = useMemo(() => {
    return [...(dashboard?.recentTransactions || [])].sort((a, b) => {
      const tA = rowTimeValue(a, ["occurredAt", "createdAt"]);
      const tB = rowTimeValue(b, ["occurredAt", "createdAt"]);
      if (tA !== tB) return tB - tA;
      return rowTimeValue(b, ["createdAt"]) - rowTimeValue(a, ["createdAt"]);
    });
  }, [dashboard?.recentTransactions]);

  if (!mounted) return null;

  return (
    <div className="studio-page-container mx-auto w-full max-w-[1500px] space-y-4 overflow-hidden sm:space-y-5">
      <section className="overflow-hidden rounded-[1.25rem] border border-[#F7C4CA] bg-[#FFF8F1] p-3 shadow-[0_18px_50px_rgba(184,95,108,0.12)] sm:rounded-[2rem] sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="mb-3 flex w-full max-w-xl items-center rounded-[1.15rem] border-2 border-[#F7AFC0] bg-white px-3 py-2.5 sm:mb-4 sm:w-fit sm:rounded-[1.5rem] sm:border-4 sm:px-5 sm:py-3">
              <StudioCatMark />
            </div>
            <p className="max-w-2xl text-sm font-semibold leading-6 text-[#8C655E] sm:text-base">
              Đi nhanh vào booking, dự án, hóa đơn, thu chi và chăm sóc khách.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            <Link className="min-w-0" href="/booking" onClick={() => setActiveResource("booking")}>
              <Button className="w-full sm:w-auto">Tạo booking</Button>
            </Link>
            <Button className="w-full sm:w-auto" variant="secondary" onClick={() => goToResource("ai")}>
              AI
            </Button>
          </div>
        </div>
      </section>

      <div className="grid min-w-0 grid-cols-2 gap-2 sm:gap-3">
        <Card className="min-w-0 overflow-hidden border-[#F7AFC0] p-3 shadow-[0_14px_38px_rgba(184,95,108,0.1)] sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base sm:text-xl">Lịch sắp tới</CardTitle>
            {displayBookings.length > previewLimit ? (
              <button type="button" onClick={() => setShowAllBookings((open) => !open)} className="shrink-0 text-xs font-black text-[#EA7188]">
                {showAllBookings ? "Thu gọn" : "Xem thêm"}
              </button>
            ) : null}
          </div>
          <div className={`studio-ios-scroll mt-3 space-y-2 ${showAllBookings ? "max-h-[18rem] overflow-y-auto pr-1" : ""}`}>
            {displayBookings.length === 0 ? (
              <div className="rounded-2xl bg-[#FFF3EC] p-3">
                <p className="text-xs font-black text-[#5B342C] sm:text-sm">Không có lịch sắp tới.</p>
                <p className="mt-1 text-[11px] font-semibold leading-5 text-[#9B746B] sm:text-xs">Khi có booking mới, lịch gần nhất sẽ hiện ở đây để bạn chuẩn bị.</p>
              </div>
            ) : null}
            {(showAllBookings ? displayBookings : displayBookings.slice(0, previewLimit)).map((item, index) => (
              <button key={item?.id ? String(item.id) : `booking-${index}`} type="button" onClick={() => item && goToBooking(item)} className="block w-full min-w-0 rounded-2xl border border-[#F7C4CA] bg-[#FFF3EC] p-2.5 text-left transition hover:bg-[#FFE4EA] sm:p-3">
                <span className="mb-1 inline-flex rounded-full bg-white px-2 py-0.5 text-[10px] font-black text-[#EA7188] shadow-sm">
                  {upcomingBookingBadge(item)}
                </span>
                <p className="line-clamp-2 break-words text-xs font-black leading-5 text-[#5B342C] sm:text-sm">{upcomingBookingTitle(item)}</p>
                <p className="mt-1 text-[11px] font-semibold text-[#9B746B] sm:text-xs">{upcomingBookingTime(item)}</p>
              </button>
            ))}
          </div>
        </Card>

        <Card className="min-w-0 overflow-hidden border-[#F7AFC0] p-3 shadow-[0_14px_38px_rgba(184,95,108,0.1)] sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base sm:text-xl">Giao dịch gần đây</CardTitle>
            {displayTransactions.length > previewLimit ? (
              <button type="button" onClick={() => setShowAllTransactions((open) => !open)} className="shrink-0 text-xs font-black text-[#EA7188]">
                {showAllTransactions ? "Thu gọn" : "Xem thêm"}
              </button>
            ) : null}
          </div>
          <div className={`studio-ios-scroll mt-3 space-y-2 ${showAllTransactions ? "max-h-[18rem] overflow-y-auto pr-1" : ""}`}>
            {displayTransactions.length === 0 ? <p className="text-xs font-semibold text-[#9B746B] sm:text-sm">Chưa có giao dịch.</p> : null}
            {(showAllTransactions ? displayTransactions : displayTransactions.slice(0, previewLimit)).map((item, index) => (
              <button key={item?.id ? String(item.id) : `tx-${index}`} onClick={() => item && goToTransaction(item)} className="grid w-full min-w-0 grid-cols-1 gap-1 rounded-2xl bg-[#FFF3EC] p-2.5 text-left transition hover:bg-[#FFE4EA] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-3 sm:p-3">
                <div className="min-w-0">
                  <p className="line-clamp-2 break-words text-xs font-black leading-5 text-[#5B342C] sm:text-sm">{String(item?.title ?? "Giao dịch")}</p>
                  <p className="mt-1 text-[11px] font-semibold text-[#9B746B] sm:text-xs">{formatDate(item?.occurredAt as string | Date)}</p>
                </div>
                <p className={`min-w-0 break-words text-left text-xs font-black leading-5 sm:max-w-[10rem] sm:text-right sm:text-sm ${String(item?.type ?? "") === "EXPENSE" ? "text-rose-600" : "text-emerald-700"}`}>
                  {String(item?.type ?? "") === "EXPENSE" ? "-" : "+"}
                  {formatMoney(item?.amount as number | string)}
                </p>
              </button>
            ))}
          </div>
        </Card>
      </div>

      <Card>
        <CardTitle>Luồng vận hành</CardTitle>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3 xl:grid-cols-6">
          {flow.map((item) => {
            const Icon = item.icon;
            const tile = (
              <div className="min-h-20 rounded-2xl border border-[#F4C7C4] bg-[#FFF3EC] p-2.5 text-left transition active:scale-[0.98] hover:-translate-y-0.5 hover:bg-white hover:shadow-md sm:min-h-28 sm:rounded-[1.4rem] sm:p-4">
                <div className="grid h-8 w-8 place-items-center rounded-xl bg-white text-[#EA7188] sm:h-11 sm:w-11 sm:rounded-2xl">
                  <Icon size={18} />
                </div>
                <p className="mt-2 text-sm font-black leading-5 text-[#5B342C] sm:mt-3 sm:text-lg">{item.title}</p>
              </div>
            );
            return item.href ? (
              <Link key={item.title} href={item.href} onClick={() => setActiveResource(item.id)}>
                {tile}
              </Link>
            ) : (
              <button key={item.title} className="text-left" onClick={() => goToResource(item.id)}>
                {tile}
              </button>
            );
          })}
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {quick.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.title}
              onClick={() => goToResource(item.id)}
              className="min-h-20 rounded-2xl border border-[#F4C7C4] bg-white p-2.5 text-left shadow-sm transition active:scale-[0.98] hover:-translate-y-0.5 hover:shadow-md sm:min-h-32 sm:rounded-[1.5rem] sm:p-5"
            >
              <Icon className="text-[#EA7188]" size={20} />
              <p className="mt-2 text-sm font-black leading-5 text-[#5B342C] sm:mt-4 sm:text-lg">{item.title}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
