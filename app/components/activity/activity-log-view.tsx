"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, CalendarDays, Loader2, Search, ShieldCheck, X } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Card } from "@/app/components/ui/card";
import { HistoryList, type ProfileAuditLog } from "@/app/components/profile/history-list";
import { cn } from "@/app/utils/cn";

type ActivityPayload = {
  items: ProfileAuditLog[];
  nextCursor: string | null;
  hasMore: boolean;
};

export function ActivityLogView({ compact = false }: { compact?: boolean }) {
  const [logs, setLogs] = useState<ProfileAuditLog[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [query, setQuery] = useState("");
  const [dateFilterOpen, setDateFilterOpen] = useState(false);
  const hasDateFilter = Boolean(from || to);

  const load = useCallback(async (mode: "reset" | "append" = "reset", cursor?: string | null) => {
    setLoading(true);
    const params = new URLSearchParams({ take: "80" });
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (mode === "append" && cursor) params.set("cursor", cursor);
    const result = await fetch(`/api/activity?${params.toString()}`, { cache: "no-store" })
      .then((res) => res.json())
      .catch(() => null);
    setLoading(false);
    const payload = result?.data as ActivityPayload | undefined;
    if (!payload) return;
    setLogs((current) => mode === "append" ? [...current, ...payload.items] : payload.items);
    setNextCursor(payload.nextCursor);
    setHasMore(payload.hasMore);
  }, [from, to]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load("reset"), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return logs;
    return logs.filter((log) => {
      const metadata = log.metadata ? JSON.stringify(log.metadata).toLowerCase() : "";
      return [log.action, log.entity, log.actorName, log.actorRole, metadata].some((value) => String(value ?? "").toLowerCase().includes(keyword));
    });
  }, [logs, query]);

  function clearDateFilter() {
    setFrom("");
    setTo("");
  }

  return (
    <div className={cn(compact ? "" : "mx-auto max-w-[1100px]")}>
      <Card className={cn("border-[#F4C7C4] bg-white p-5 shadow-sm", compact ? "rounded-[1.5rem]" : "rounded-[2rem]")}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#EA7188]">Lịch sử hoạt động</p>
            <h1 className={cn("mt-1 font-black text-[#5B342C]", compact ? "text-2xl" : "text-3xl")}>Ai đã làm gì</h1>
            <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-[#8C655E]">
              Theo dõi tạo, sửa, xóa, đăng nhập, đóng ca, import/restore và các thao tác quan trọng trong studio.
            </p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-2xl bg-[#FFF0F4] px-4 py-2 text-sm font-black text-[#A84E61]">
            <ShieldCheck size={16} />
            {logs.length} hoạt động
          </span>
        </div>

        <div className="mt-5 grid gap-2 lg:grid-cols-[1fr_auto]">
          <label className="flex h-12 min-w-0 items-center gap-2 rounded-2xl border border-[#F4C7C4] bg-[#FFF9F4] px-3">
            <Search size={17} className="shrink-0 text-[#EA7188]" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm trong nhật ký..." className="min-w-0 flex-1 bg-transparent text-sm font-bold outline-none" />
          </label>
          <Button
            type="button"
            variant={dateFilterOpen ? "primary" : "secondary"}
            className="min-h-12 w-full lg:w-auto"
            onClick={() => setDateFilterOpen((open) => !open)}
          >
            <CalendarDays size={16} />
            {dateFilterOpen ? "Thu gọn lọc ngày" : hasDateFilter ? "Sửa lọc ngày" : "Lọc ngày"}
          </Button>
        </div>

        {hasDateFilter && !dateFilterOpen ? (
          <p className="mt-2 text-xs font-bold text-[#9B746B]">
            Đang lọc: {from || "đầu kỳ"} đến {to || "hiện tại"}
          </p>
        ) : null}

        {dateFilterOpen ? (
          <div className="mt-3 rounded-3xl border border-[#F4C7C4] bg-[#FFF9F4] p-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="text-xs font-black uppercase text-[#B98278]">
                Từ ngày
                <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="mt-1 h-11 w-full rounded-xl border border-[#F4C7C4] bg-white px-3 text-sm font-semibold normal-case text-[#5B342C] outline-none" />
              </label>
              <label className="text-xs font-black uppercase text-[#B98278]">
                Đến ngày
                <input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="mt-1 h-11 w-full rounded-xl border border-[#F4C7C4] bg-white px-3 text-sm font-semibold normal-case text-[#5B342C] outline-none" />
              </label>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="secondary" onClick={() => void load("reset")}>
                <CalendarDays size={16} />
                Áp dụng
              </Button>
              {hasDateFilter ? (
                <Button type="button" size="sm" variant="ghost" onClick={clearDateFilter}>
                  <X size={16} />
                  Xóa lọc
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="mt-5 border-t border-[#F4C7C4] pt-4">
          <HistoryList logs={filtered} />
        </div>

        {hasMore ? (
          <Button className="mt-4 w-full" variant="secondary" disabled={loading} onClick={() => void load("append", nextCursor)}>
            {loading ? <Loader2 className="animate-spin" size={16} /> : <Activity size={16} />}
            Tải thêm nhật ký
          </Button>
        ) : null}
      </Card>
    </div>
  );
}
