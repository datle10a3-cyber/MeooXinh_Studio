"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Activity, Building2, Copy, Eye, KeyRound, Loader2, Lock, LockKeyhole, RefreshCw, RotateCcw, ShieldCheck, Trash2, UnlockKeyhole, UserCheck } from "lucide-react";
import { AlertModal } from "@/app/components/ui/alert-modal";
import { Button } from "@/app/components/ui/button";
import { Card } from "@/app/components/ui/card";
import { Portal } from "@/app/components/ui/portal";
import { PageSpinner } from "@/app/components/ui/skeleton";
import { useUiStore } from "@/app/store/ui-store";
import type { CurrentSession } from "@/app/types/auth";
import { Input } from "@/app/components/ui/input";

type AdminRow = {
  id: string;
  name: string;
  email: string;
  status: string;
  createdAt: string;
  lastLoginAt?: string | null;
  studio?: { id: string; name: string; slug: string } | null;
  counts?: {
    customers: number;
    bookings: number;
    transactions: number;
    invoices: number;
  };
};

type ApiResult<T> = { data?: T; error?: { message: string } };
type RootSettings = {
  inviteCode: string;
  inviteCodeLockedByEnv: boolean;
  hasCustomShiftPassword: boolean;
  settingsStorageReady?: boolean;
};

function statusLabel(status: string) {
  if (status === "ACTIVE") return "Đang hoạt động";
  if (status === "DISABLED") return "Đã khóa";
  if (status === "DELETED") return "Đã xóa";
  return status;
}

function statusClass(status: string) {
  if (status === "ACTIVE") return "bg-emerald-400/10 text-emerald-100 ring-emerald-300/25";
  if (status === "DISABLED") return "bg-amber-400/10 text-amber-100 ring-amber-300/25";
  if (status === "DELETED") return "bg-rose-400/10 text-rose-100 ring-rose-300/25";
  return "bg-white/5 text-slate-200 ring-white/10";
}

export function RootAdminList() {
  const router = useRouter();
  const setSession = useUiStore((state) => state.setSession);
  const [rows, setRows] = useState<AdminRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminRow | null>(null);
  const [message, setMessage] = useState("");
  const [settings, setSettings] = useState<RootSettings | null>(null);
  const [inviteCode, setInviteCode] = useState("");
  const [shiftPassword, setShiftPassword] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);

  async function loadRows() {
    setLoading(true);
    const [adminsResult, settingsResult] = await Promise.all([
      fetch("/api/root-admin/admins").then((res) => res.json() as Promise<ApiResult<AdminRow[]>>),
      fetch("/api/root-admin/settings").then((res) => res.json() as Promise<ApiResult<RootSettings>>),
    ]);
    if (adminsResult.data) setRows(adminsResult.data);
    if (adminsResult.error) setMessage(adminsResult.error.message);
    if (settingsResult.data) {
      setSettings(settingsResult.data);
      setInviteCode(settingsResult.data.inviteCode);
    }
    if (settingsResult.error) setMessage(settingsResult.error.message);
    setLoading(false);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void loadRows(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function deleteAdmin() {
    if (!deleteTarget) return;
    setDeleting(true);
    const result = await fetch("/api/root-admin/admins", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: deleteTarget.id }),
    }).then((res) => res.json() as Promise<ApiResult<{ id: string; status: string }>>);
    setDeleting(false);
    if (result.error) return setMessage(result.error.message);
    setRows((current) => current.map((row) => row.id === deleteTarget.id ? { ...row, status: result.data?.status ?? "DELETED" } : row));
    setDeleteTarget(null);
    setMessage("Đã xóa tài khoản admin. Email này vẫn bị giữ lại và không thể đăng ký lại.");
  }

  async function updateAdminStatus(row: AdminRow, action: "disable" | "enable" | "restore") {
    setActioningId(row.id);
    const result = await fetch("/api/root-admin/admins", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: row.id, action }),
    }).then((res) => res.json() as Promise<ApiResult<{ id: string; status: string }>>);
    setActioningId(null);
    if (result.error) return setMessage(result.error.message);
    setRows((current) => current.map((item) => item.id === row.id ? { ...item, status: result.data?.status ?? item.status } : item));
    setMessage(action === "disable" ? "Đã khóa tài khoản admin." : action === "restore" ? "Đã khôi phục tài khoản admin." : "Đã mở khóa tài khoản admin.");
  }

  async function viewAsAdmin(row: AdminRow) {
    const result = await fetch("/api/root-admin/impersonate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: row.id }),
    }).then((res) => res.json() as Promise<ApiResult<CurrentSession>>);
    if (result.error) return setMessage(result.error.message);
    if (result.data) {
      setSession(result.data);
      localStorage.setItem("studio-session", JSON.stringify(result.data));
      window.dispatchEvent(new Event("studio-session-updated"));
      router.push("/", { scroll: true });
    }
  }

  async function saveSettings() {
    setSavingSettings(true);
    const result = await fetch("/api/root-admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inviteCode, shiftPassword }),
    }).then((res) => res.json() as Promise<ApiResult<RootSettings>>);
    setSavingSettings(false);
    if (result.error) return setMessage(result.error.message);
    if (result.data) {
      setSettings(result.data);
      setInviteCode(result.data.inviteCode);
      setShiftPassword("");
    }
    setMessage("Đã lưu cấu hình Super Admin.");
  }

  async function copyInviteCode() {
    await navigator.clipboard.writeText(inviteCode);
    setMessage("Đã sao chép mã mời.");
  }

  if (loading) return <PageSpinner label="Đang tải danh sách admin..." />;

  const totals = rows.reduce(
    (acc, row) => ({
      customers: acc.customers + (row.counts?.customers ?? 0),
      bookings: acc.bookings + (row.counts?.bookings ?? 0),
      transactions: acc.transactions + (row.counts?.transactions ?? 0),
      invoices: acc.invoices + (row.counts?.invoices ?? 0),
    }),
    { customers: 0, bookings: 0, transactions: 0, invoices: 0 },
  );

  const overviewCards = [
    { label: "Admin mã mời", value: rows.length, icon: UserCheck },
    { label: "Khách toàn hệ thống", value: totals.customers, icon: Building2 },
    { label: "Booking", value: totals.bookings, icon: Activity },
    { label: "Hóa đơn", value: totals.invoices, icon: ShieldCheck },
  ];

  return (
    <div className="mx-auto w-full max-w-7xl space-y-3 rounded-[1.25rem] bg-[#04110A] p-2 text-slate-100 shadow-[0_24px_80px_rgba(2,6,23,0.32)] sm:space-y-4 sm:rounded-[1.75rem] sm:p-4">
      <section className="relative overflow-hidden rounded-[1.1rem] border border-emerald-400/20 bg-[#06140D] shadow-[0_0_42px_rgba(16,185,129,0.16)] sm:rounded-[1.5rem]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_82%_10%,rgba(52,211,153,0.22),transparent_30%),linear-gradient(135deg,rgba(16,185,129,0.14),transparent_42%)]" />
        <div className="relative grid gap-3 p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-4 sm:p-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-xl border border-emerald-300/35 bg-emerald-400/10 text-emerald-200 shadow-[0_0_24px_rgba(52,211,153,0.22)] sm:h-10 sm:w-10 sm:rounded-2xl">
                <ShieldCheck size={17} />
              </span>
              <span className="text-xs font-black uppercase tracking-[0.18em] text-emerald-200 sm:text-sm sm:tracking-[0.2em]">Super Admin</span>
            </div>
            <h1 className="mt-2 text-xl font-black leading-tight text-white sm:mt-3 sm:text-3xl">Bảng điều khiển Super Admin</h1>
            <p className="mt-1 max-w-3xl text-xs font-semibold leading-5 text-slate-300 sm:mt-2 sm:text-sm sm:leading-6">Quản lý admin, mã mời đăng ký, mật khẩu xóa ca và quyền xem từng studio.</p>
          </div>
          <div className="grid gap-2 rounded-2xl border border-emerald-300/20 bg-black/25 p-2.5 backdrop-blur sm:min-w-[220px] sm:rounded-[1.25rem] sm:p-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-black uppercase tracking-wide text-slate-400">Admin mã mời</span>
              <span className="text-xl font-black text-emerald-200 sm:text-2xl">{rows.length}</span>
            </div>
            <Button variant="secondary" className="h-10 rounded-xl border-emerald-300/20 bg-emerald-400/10 text-emerald-100 hover:bg-emerald-400/20" onClick={() => void loadRows()}>
              <RefreshCw size={15} />
              Làm mới
            </Button>
          </div>
        </div>
      </section>

      <AlertModal isOpen={!!message} message={message} onClose={() => setMessage("")} />

      <section className="grid grid-cols-1 gap-2 min-[380px]:grid-cols-2 xl:grid-cols-4">
        {overviewCards.map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.label} className="rounded-2xl border-emerald-300/15 bg-[#06140D] p-3 text-slate-100 shadow-[0_10px_34px_rgba(2,6,23,0.22)] sm:rounded-[1.25rem] sm:p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="grid h-8 w-8 place-items-center rounded-xl border border-emerald-300/20 bg-emerald-400/10 text-emerald-200 sm:h-10 sm:w-10 sm:rounded-2xl">
                  <Icon size={16} />
                </span>
                <span className="text-xl font-black tabular-nums text-white sm:text-2xl">{item.value}</span>
              </div>
              <p className="mt-2 text-[10px] font-black uppercase tracking-wide text-slate-400 sm:mt-3 sm:text-xs">{item.label}</p>
            </Card>
          );
        })}
      </section>

      <section className="grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="rounded-[1.1rem] border-emerald-300/20 bg-[#06140D] p-3 text-slate-100 shadow-[0_0_34px_rgba(16,185,129,0.10)] sm:rounded-[1.5rem] sm:p-4">
          <div className="flex items-center gap-2">
            <KeyRound size={18} className="text-emerald-300" />
            <h2 className="text-base font-black text-white sm:text-lg">Chính sách truy cập</h2>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
            <label className="min-w-0 text-xs font-black uppercase tracking-wide text-slate-400">
              Mã mời đăng ký admin
              <Input className="mt-2 border-emerald-300/25 bg-[#020617] text-emerald-100 placeholder:text-slate-500 focus:border-emerald-300 focus:ring-emerald-500/25" value={inviteCode} onChange={(event) => setInviteCode(event.target.value)} />
            </label>
            <div className="grid gap-2 sm:w-36 sm:self-end">
              <Button variant="secondary" className="h-11 rounded-xl border-emerald-300/25 bg-emerald-400/10 text-emerald-100 hover:bg-emerald-400/20" onClick={() => void copyInviteCode()}>
                <Copy size={15} />
                Sao chép
              </Button>
            </div>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
            <label className="min-w-0 text-xs font-black uppercase tracking-wide text-slate-400">
              Mật khẩu xóa ca mặc định
              <Input
                className="mt-2 border-emerald-300/25 bg-[#020617] text-emerald-100 placeholder:text-slate-500 focus:border-emerald-300 focus:ring-emerald-500/25"
                type="password"
                inputMode="numeric"
                placeholder={settings?.hasCustomShiftPassword ? "Đã có mật khẩu" : "000000"}
                value={shiftPassword}
                onChange={(event) => setShiftPassword(event.target.value.replace(/\D/g, "").slice(0, 6))}
              />
            </label>
            <Button className="h-11 rounded-xl bg-emerald-400 text-[#03140C] shadow-[0_0_22px_rgba(52,211,153,0.28)] hover:bg-emerald-300 sm:w-36 sm:self-end" onClick={() => void saveSettings()} disabled={savingSettings}>
              {savingSettings ? <Loader2 size={16} className="animate-spin" /> : <LockKeyhole size={16} />}
              Lưu
            </Button>
          </div>
        </Card>

        <Card className="rounded-[1.1rem] border-emerald-300/20 bg-[#0A120D] p-3 text-slate-100 shadow-[0_0_34px_rgba(16,185,129,0.10)] sm:rounded-[1.5rem] sm:p-4">
          <div className="flex items-center gap-2">
            <Activity size={18} className="text-emerald-300" />
            <h2 className="text-base font-black text-white sm:text-lg">Trạng thái quản trị</h2>
          </div>
          <div className="mt-4 grid gap-2">
            <div className="flex items-center justify-between gap-3 rounded-2xl bg-white/5 px-3 py-2 ring-1 ring-emerald-300/15">
              <span className="text-sm font-bold text-slate-300">Lưu cấu hình</span>
              <span className="text-sm font-black text-emerald-200">{settings?.settingsStorageReady === false ? "Tự khởi tạo" : "Sẵn sàng"}</span>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-2xl bg-white/5 px-3 py-2 ring-1 ring-emerald-300/15">
              <span className="text-sm font-bold text-slate-300">Mã mời</span>
              <span className="text-sm font-black text-emerald-200">Có thể đổi trong app</span>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-2xl bg-white/5 px-3 py-2 ring-1 ring-emerald-300/15">
              <span className="text-sm font-bold text-slate-300">Mật khẩu xóa ca</span>
              <span className="text-sm font-black text-emerald-200">{settings?.hasCustomShiftPassword ? "Đã cấu hình" : "Mặc định"}</span>
            </div>
          </div>
        </Card>
      </section>

      <section className="rounded-[1.1rem] border border-emerald-300/20 bg-[#06140D] p-2.5 shadow-[0_0_34px_rgba(16,185,129,0.10)] sm:rounded-[1.5rem] sm:p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Building2 size={18} className="text-emerald-300" />
            <h2 className="text-base font-black text-white sm:text-lg">Admin mã mời và studio được quản lý</h2>
          </div>
        </div>
        <div className="grid gap-3">
          {rows.length ? rows.map((row) => (
            <Card key={row.id} className="rounded-2xl border-white/10 bg-white/[0.04] p-2.5 text-slate-100 shadow-sm sm:rounded-[1.25rem] sm:p-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="grid h-8 w-8 place-items-center rounded-xl bg-emerald-400/10 text-emerald-200 ring-1 ring-emerald-300/25 sm:h-9 sm:w-9 sm:rounded-2xl"><UserCheck size={16} /></span>
                    <div className="min-w-0">
                      <h2 className="truncate text-base font-black text-white">{row.name || "Admin"}</h2>
                      <p className="truncate text-sm font-bold text-slate-400">{row.email}</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ring-1 ${statusClass(row.status)}`}>
                      {statusLabel(row.status)}
                    </span>
                  </div>
                  <p className="mt-2 truncate text-xs font-bold uppercase tracking-wide text-emerald-200">{row.studio?.name ?? "Không rõ studio"}</p>
                  <div className="mt-2 grid grid-cols-1 gap-1 text-center text-[10px] font-black text-slate-300 min-[360px]:grid-cols-2 sm:grid-cols-4 sm:text-[11px]">
                    <span className="rounded-xl bg-white/5 px-2 py-1 ring-1 ring-white/10">{row.counts?.customers ?? 0} khách</span>
                    <span className="rounded-xl bg-white/5 px-2 py-1 ring-1 ring-white/10">{row.counts?.bookings ?? 0} booking</span>
                    <span className="rounded-xl bg-white/5 px-2 py-1 ring-1 ring-white/10">{row.counts?.transactions ?? 0} thu chi</span>
                    <span className="rounded-xl bg-white/5 px-2 py-1 ring-1 ring-white/10">{row.counts?.invoices ?? 0} hóa đơn</span>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-2 min-[360px]:grid-cols-2 sm:w-44 sm:grid-cols-1">
                  <Button className="min-h-10 rounded-xl bg-emerald-400 text-[#03140C] hover:bg-emerald-300 sm:min-h-11 sm:rounded-2xl" onClick={() => void viewAsAdmin(row)}>
                    <Eye size={16} />
                    Vào xem
                  </Button>
                  {row.status === "ACTIVE" ? (
                    <Button variant="secondary" className="min-h-10 rounded-xl border-amber-300/25 bg-amber-400/10 text-amber-100 hover:bg-amber-400/20 sm:min-h-11 sm:rounded-2xl" onClick={() => void updateAdminStatus(row, "disable")} disabled={actioningId === row.id}>
                      {actioningId === row.id ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />}
                      Khóa tạm thời
                    </Button>
                  ) : null}
                  {row.status === "DISABLED" ? (
                    <Button variant="secondary" className="min-h-10 rounded-xl border-emerald-300/25 bg-emerald-400/10 text-emerald-100 hover:bg-emerald-400/20 sm:min-h-11 sm:rounded-2xl" onClick={() => void updateAdminStatus(row, "enable")} disabled={actioningId === row.id}>
                      {actioningId === row.id ? <Loader2 size={16} className="animate-spin" /> : <UnlockKeyhole size={16} />}
                      Mở khóa
                    </Button>
                  ) : null}
                  {row.status === "DELETED" ? (
                    <Button variant="secondary" className="min-h-10 rounded-xl border-emerald-300/25 bg-emerald-400/10 text-emerald-100 hover:bg-emerald-400/20 sm:min-h-11 sm:rounded-2xl" onClick={() => void updateAdminStatus(row, "restore")} disabled={actioningId === row.id}>
                      {actioningId === row.id ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={16} />}
                      Khôi phục
                    </Button>
                  ) : (
                    <Button variant="secondary" className="col-span-2 min-h-10 rounded-xl border-rose-300/25 bg-rose-400/10 text-rose-100 hover:bg-rose-400/20 sm:col-span-1 sm:min-h-11 sm:rounded-2xl" onClick={() => setDeleteTarget(row)}>
                      <Trash2 size={16} />
                      Xóa tài khoản
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          )) : (
            <Card className="rounded-[1.5rem] border-white/10 bg-white/[0.04] p-6 text-center">
              <p className="text-sm font-bold text-slate-300">Chưa có admin mã mời nào khác.</p>
            </Card>
          )}
        </div>
      </section>

      {deleteTarget ? (
        <Portal>
          <div className="fixed inset-0 z-[230] grid place-items-center bg-slate-950/75 p-4 backdrop-blur-sm" onClick={() => (deleting ? undefined : setDeleteTarget(null))}>
            <Card className="w-full max-w-md rounded-[1.5rem] border-emerald-300/20 bg-[#06140D] p-5 text-slate-100 shadow-[0_24px_80px_rgba(2,6,23,0.65)]" onClick={(event) => event.stopPropagation()}>
              <div className="flex items-start gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-emerald-300/25 bg-emerald-400/10 text-emerald-200">
                  <Trash2 size={18} />
                </span>
                <div className="min-w-0">
                  <h3 className="text-lg font-black text-white">Xóa tài khoản admin</h3>
                  <p className="mt-1 text-sm font-semibold leading-6 text-slate-300">
                    Xóa quyền đăng nhập của <span className="font-black text-emerald-100">{deleteTarget.email}</span>? Email này sẽ không thể đăng ký lại, admin vẫn nằm trong danh sách để khôi phục khi cần.
                  </p>
                </div>
              </div>
              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                <Button variant="secondary" className="h-11 rounded-xl border-slate-500/30 bg-slate-900 text-slate-100 hover:bg-slate-800" onClick={() => setDeleteTarget(null)} disabled={deleting}>
                  Hủy
                </Button>
                <Button className="h-11 rounded-xl bg-emerald-400 text-[#03140C] hover:bg-emerald-300" onClick={() => void deleteAdmin()} disabled={deleting}>
                  {deleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                  Xóa tài khoản
                </Button>
              </div>
            </Card>
          </div>
        </Portal>
      ) : null}

      {deleting ? (
        <div className="fixed inset-0 z-[240] grid place-items-center bg-black/10">
          <Loader2 className="animate-spin text-emerald-300" size={28} />
        </div>
      ) : null}
    </div>
  );
}
