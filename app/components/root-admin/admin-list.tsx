"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Database, Eye, KeyRound, Loader2, LockKeyhole, ShieldCheck, Trash2, Users } from "lucide-react";
import { AlertModal } from "@/app/components/ui/alert-modal";
import { Button } from "@/app/components/ui/button";
import { Card } from "@/app/components/ui/card";
import { DeleteConfirmation } from "@/app/components/ui/delete-confirmation";
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

export function RootAdminList() {
  const router = useRouter();
  const setSession = useUiStore((state) => state.setSession);
  const [rows, setRows] = useState<AdminRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
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
    }).then((res) => res.json() as Promise<ApiResult<{ id: string }>>);
    setDeleting(false);
    if (result.error) return setMessage(result.error.message);
    setRows((current) => current.filter((row) => row.id !== deleteTarget.id));
    setDeleteTarget(null);
    setMessage("Đã xóa quyền đăng nhập của admin này.");
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
      router.push("/", { scroll: false });
    }
  }

  async function saveSettings() {
    setSavingSettings(true);
    const result = await fetch("/api/root-admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        inviteCode: settings?.inviteCodeLockedByEnv ? "" : inviteCode,
        shiftPassword,
      }),
    }).then((res) => res.json() as Promise<ApiResult<RootSettings>>);
    setSavingSettings(false);
    if (result.error) return setMessage(result.error.message);
    if (result.data) {
      setSettings(result.data);
      setInviteCode(result.data.inviteCode);
      setShiftPassword("");
    }
    setMessage("Đã lưu cấu hình admin chính.");
  }

  if (loading) return <PageSpinner label="Đang tải danh sách admin..." />;
  const totals = rows.reduce(
    (sum, row) => ({
      customers: sum.customers + (row.counts?.customers ?? 0),
      bookings: sum.bookings + (row.counts?.bookings ?? 0),
      transactions: sum.transactions + (row.counts?.transactions ?? 0),
      invoices: sum.invoices + (row.counts?.invoices ?? 0),
    }),
    { customers: 0, bookings: 0, transactions: 0, invoices: 0 },
  );

  return (
    <div className="space-y-4">
      <div className="rounded-[1.5rem] border border-[#F4C7C4] bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#EA7188]">Admin chính</p>
            <h1 className="mt-1 text-2xl font-black text-[#5B342C] sm:text-3xl">Trung tâm quản lý</h1>
          </div>
          <span className="rounded-full bg-[#FFF0F4] px-3 py-1 text-xs font-black text-[#A84E61]">{rows.length} admin mã mời</span>
        </div>
      </div>

      <AlertModal isOpen={!!message} message={message} onClose={() => setMessage("")} />

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: "Admin", value: rows.length, icon: Users },
          { label: "Khách", value: totals.customers, icon: Users },
          { label: "Booking", value: totals.bookings, icon: Database },
          { label: "Hóa đơn", value: totals.invoices, icon: ShieldCheck },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.label} className="rounded-[1.25rem] border-[#F4C7C4] bg-white p-3 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="grid h-9 w-9 place-items-center rounded-2xl bg-[#FFF0F4] text-[#EA7188]"><Icon size={17} /></span>
                <span className="text-xl font-black text-[#5B342C]">{item.value}</span>
              </div>
              <p className="mt-2 text-xs font-black uppercase tracking-wide text-[#9B746B]">{item.label}</p>
            </Card>
          );
        })}
      </section>

      <section className="rounded-[1.5rem] border border-[#F4C7C4] bg-white p-3 shadow-sm sm:p-4">
        <div className="mb-3 flex items-center gap-2">
          <KeyRound size={18} className="text-[#EA7188]" />
          <h2 className="text-lg font-black text-[#5B342C]">Bảo mật hệ thống</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <label className="min-w-0 text-xs font-black uppercase tracking-wide text-[#9B746B]">
            Mã mời đăng ký
            <Input
              className="mt-2"
              value={inviteCode}
              disabled={settings?.inviteCodeLockedByEnv}
              onChange={(event) => setInviteCode(event.target.value)}
            />
            {settings?.inviteCodeLockedByEnv ? <span className="mt-1 block normal-case text-[11px] text-[#EA7188]">Đang khóa bằng biến môi trường Vercel.</span> : null}
          </label>
          <label className="min-w-0 text-xs font-black uppercase tracking-wide text-[#9B746B]">
            Mật khẩu xóa ca mặc định
            <Input
              className="mt-2"
              type="password"
              inputMode="numeric"
              placeholder={settings?.hasCustomShiftPassword ? "Đã có mật khẩu" : "000000"}
              value={shiftPassword}
              onChange={(event) => setShiftPassword(event.target.value.replace(/\D/g, "").slice(0, 6))}
            />
            {settings?.settingsStorageReady === false ? <span className="mt-1 block normal-case text-[11px] text-amber-700">Production chưa migrate bảng cấu hình, vẫn dùng mã/mật khẩu mặc định.</span> : null}
          </label>
          <Button className="min-h-12 self-end rounded-2xl" onClick={() => void saveSettings()} disabled={savingSettings || settings?.settingsStorageReady === false}>
            {savingSettings ? <Loader2 size={16} className="animate-spin" /> : <LockKeyhole size={16} />}
            Lưu bảo mật
          </Button>
        </div>
      </section>

      <section className="rounded-[1.5rem] border border-[#F4C7C4] bg-white p-3 shadow-sm sm:p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} className="text-[#EA7188]" />
            <h2 className="text-lg font-black text-[#5B342C]">Quản lý quyền truy cập</h2>
          </div>
        </div>
        <div className="grid gap-3">
        {rows.length ? rows.map((row) => (
          <Card key={row.id} className="rounded-[1.25rem] border-[#F4C7C4] bg-[#FFFDFB] p-3 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <h2 className="truncate text-base font-black text-[#5B342C]">{row.name || "Admin"}</h2>
                <p className="truncate text-sm font-bold text-[#9B746B]">{row.email}</p>
                <p className="mt-1 truncate text-xs font-bold text-[#7B554D]">{row.studio?.name ?? "Không rõ studio"}</p>
                <div className="mt-2 grid grid-cols-4 gap-1 text-center text-[11px] font-black text-[#7B554D]">
                  <span className="rounded-xl bg-white px-2 py-1">{row.counts?.customers ?? 0} khách</span>
                  <span className="rounded-xl bg-white px-2 py-1">{row.counts?.bookings ?? 0} lịch</span>
                  <span className="rounded-xl bg-white px-2 py-1">{row.counts?.transactions ?? 0} thu chi</span>
                  <span className="rounded-xl bg-white px-2 py-1">{row.counts?.invoices ?? 0} HĐ</span>
                </div>
              </div>
              <div className="grid gap-2 sm:w-40">
                <Button className="min-h-11 rounded-2xl" onClick={() => void viewAsAdmin(row)}>
                  <Eye size={16} />
                  Vào xem
                </Button>
                <Button variant="danger" className="min-h-11 rounded-2xl" onClick={() => setDeleteTarget(row)}>
                  <Trash2 size={16} />
                  Xóa admin
                </Button>
              </div>
            </div>
          </Card>
        )) : (
          <Card className="rounded-[1.5rem] border-[#F4C7C4] bg-white p-6 text-center">
            <p className="text-sm font-bold text-[#9B746B]">Chưa có admin mã mời nào khác.</p>
          </Card>
        )}
        </div>
      </section>

      <DeleteConfirmation
        open={Boolean(deleteTarget)}
        title="Xóa admin"
        description={`Xóa quyền đăng nhập admin "${deleteTarget?.email ?? ""}"? Dữ liệu studio của admin đó không bị xóa.`}
        onHardDelete={() => void deleteAdmin()}
        onMoveToTrash={() => setDeleteTarget(null)}
        onCancel={() => deleting ? undefined : setDeleteTarget(null)}
        hardLabel="Xóa admin"
        trashLabel="Hủy"
        loading={deleting}
      />

      {deleting ? (
        <div className="fixed inset-0 z-[240] grid place-items-center bg-black/10">
          <Loader2 className="animate-spin text-[#EA7188]" size={28} />
        </div>
      ) : null}
    </div>
  );
}
