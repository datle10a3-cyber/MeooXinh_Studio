"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Activity, Building2, Copy, Eye, KeyRound, Loader2, LockKeyhole, RefreshCw, ShieldCheck, Trash2, UserCheck } from "lucide-react";
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
    setMessage("Da xoa quyen dang nhap cua admin nay.");
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
      body: JSON.stringify({ inviteCode, shiftPassword }),
    }).then((res) => res.json() as Promise<ApiResult<RootSettings>>);
    setSavingSettings(false);
    if (result.error) return setMessage(result.error.message);
    if (result.data) {
      setSettings(result.data);
      setInviteCode(result.data.inviteCode);
      setShiftPassword("");
    }
    setMessage("Da luu cau hinh Super Admin.");
  }

  async function copyInviteCode() {
    await navigator.clipboard.writeText(inviteCode);
    setMessage("Da sao chep ma moi.");
  }

  if (loading) return <PageSpinner label="Dang tai danh sach admin..." />;

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
    { label: "Admin ma moi", value: rows.length, icon: UserCheck },
    { label: "Khach toan he thong", value: totals.customers, icon: Building2 },
    { label: "Booking", value: totals.bookings, icon: Activity },
    { label: "Hoa don", value: totals.invoices, icon: ShieldCheck },
  ];

  return (
    <div className="space-y-4 rounded-[1.75rem] bg-[#04110A] p-3 text-slate-100 shadow-[0_24px_80px_rgba(2,6,23,0.32)] sm:p-4">
      <section className="relative overflow-hidden rounded-[1.5rem] border border-emerald-400/20 bg-[#06140D] shadow-[0_0_42px_rgba(16,185,129,0.16)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_82%_10%,rgba(52,211,153,0.22),transparent_30%),linear-gradient(135deg,rgba(16,185,129,0.14),transparent_42%)]" />
        <div className="relative grid gap-4 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:p-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="grid h-10 w-10 place-items-center rounded-2xl border border-emerald-300/35 bg-emerald-400/10 text-emerald-200 shadow-[0_0_24px_rgba(52,211,153,0.22)]">
                <ShieldCheck size={18} />
              </span>
              <span className="text-sm font-black uppercase tracking-[0.2em] text-emerald-200">Super Admin</span>
            </div>
            <h1 className="mt-3 text-2xl font-black leading-tight text-white sm:text-3xl">Bang dieu khien Super Admin</h1>
            <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-300">Quan ly admin, ma moi dang ky, mat khau xoa ca va quyen xem tung studio.</p>
          </div>
          <div className="grid min-w-[220px] gap-2 rounded-[1.25rem] border border-emerald-300/20 bg-black/25 p-3 backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-black uppercase tracking-wide text-slate-400">Admin ma moi</span>
              <span className="text-2xl font-black text-emerald-200">{rows.length}</span>
            </div>
            <Button variant="secondary" className="h-10 rounded-xl border-emerald-300/20 bg-emerald-400/10 text-emerald-100 hover:bg-emerald-400/20" onClick={() => void loadRows()}>
              <RefreshCw size={15} />
              Lam moi
            </Button>
          </div>
        </div>
      </section>

      <AlertModal isOpen={!!message} message={message} onClose={() => setMessage("")} />

      <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {overviewCards.map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.label} className="rounded-[1.25rem] border-emerald-300/15 bg-[#06140D] p-4 text-slate-100 shadow-[0_10px_34px_rgba(2,6,23,0.22)]">
              <div className="flex items-center justify-between gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-2xl border border-emerald-300/20 bg-emerald-400/10 text-emerald-200">
                  <Icon size={17} />
                </span>
                <span className="text-2xl font-black tabular-nums text-white">{item.value}</span>
              </div>
              <p className="mt-3 text-xs font-black uppercase tracking-wide text-slate-400">{item.label}</p>
            </Card>
          );
        })}
      </section>

      <section className="grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="rounded-[1.5rem] border-emerald-300/20 bg-[#06140D] p-4 text-slate-100 shadow-[0_0_34px_rgba(16,185,129,0.10)]">
          <div className="flex items-center gap-2">
            <KeyRound size={18} className="text-emerald-300" />
            <h2 className="text-lg font-black text-white">Chinh sach truy cap</h2>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
            <label className="min-w-0 text-xs font-black uppercase tracking-wide text-slate-400">
              Ma moi dang ky admin
              <Input className="mt-2 border-emerald-300/25 bg-[#020617] text-emerald-100 placeholder:text-slate-500 focus:border-emerald-300 focus:ring-emerald-500/25" value={inviteCode} onChange={(event) => setInviteCode(event.target.value)} />
            </label>
            <div className="grid gap-2 sm:w-36 sm:self-end">
              <Button variant="secondary" className="h-11 rounded-xl border-emerald-300/25 bg-emerald-400/10 text-emerald-100 hover:bg-emerald-400/20" onClick={() => void copyInviteCode()}>
                <Copy size={15} />
                Sao chep
              </Button>
            </div>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
            <label className="min-w-0 text-xs font-black uppercase tracking-wide text-slate-400">
              Mat khau xoa ca mac dinh
              <Input
                className="mt-2 border-emerald-300/25 bg-[#020617] text-emerald-100 placeholder:text-slate-500 focus:border-emerald-300 focus:ring-emerald-500/25"
                type="password"
                inputMode="numeric"
                placeholder={settings?.hasCustomShiftPassword ? "Da co mat khau" : "000000"}
                value={shiftPassword}
                onChange={(event) => setShiftPassword(event.target.value.replace(/\D/g, "").slice(0, 6))}
              />
            </label>
            <Button className="h-11 rounded-xl bg-emerald-400 text-[#03140C] shadow-[0_0_22px_rgba(52,211,153,0.28)] hover:bg-emerald-300 sm:w-36 sm:self-end" onClick={() => void saveSettings()} disabled={savingSettings}>
              {savingSettings ? <Loader2 size={16} className="animate-spin" /> : <LockKeyhole size={16} />}
              Luu
            </Button>
          </div>
        </Card>

        <Card className="rounded-[1.5rem] border-emerald-300/20 bg-[#0A120D] p-4 text-slate-100 shadow-[0_0_34px_rgba(16,185,129,0.10)]">
          <div className="flex items-center gap-2">
            <Activity size={18} className="text-emerald-300" />
            <h2 className="text-lg font-black text-white">Trang thai quan tri</h2>
          </div>
          <div className="mt-4 grid gap-2">
            <div className="flex items-center justify-between gap-3 rounded-2xl bg-white/5 px-3 py-2 ring-1 ring-emerald-300/15">
              <span className="text-sm font-bold text-slate-300">Luu cau hinh</span>
              <span className="text-sm font-black text-emerald-200">{settings?.settingsStorageReady === false ? "Tu khoi tao" : "San sang"}</span>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-2xl bg-white/5 px-3 py-2 ring-1 ring-emerald-300/15">
              <span className="text-sm font-bold text-slate-300">Ma moi</span>
              <span className="text-sm font-black text-emerald-200">Co the doi trong app</span>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-2xl bg-white/5 px-3 py-2 ring-1 ring-emerald-300/15">
              <span className="text-sm font-bold text-slate-300">Mat khau xoa ca</span>
              <span className="text-sm font-black text-emerald-200">{settings?.hasCustomShiftPassword ? "Da cau hinh" : "Mac dinh"}</span>
            </div>
          </div>
        </Card>
      </section>

      <section className="rounded-[1.5rem] border border-emerald-300/20 bg-[#06140D] p-3 shadow-[0_0_34px_rgba(16,185,129,0.10)] sm:p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Building2 size={18} className="text-emerald-300" />
            <h2 className="text-lg font-black text-white">Admin ma moi va studio duoc quan ly</h2>
          </div>
        </div>
        <div className="grid gap-3">
          {rows.length ? rows.map((row) => (
            <Card key={row.id} className="rounded-[1.25rem] border-white/10 bg-white/[0.04] p-3 text-slate-100 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="grid h-9 w-9 place-items-center rounded-2xl bg-emerald-400/10 text-emerald-200 ring-1 ring-emerald-300/25"><UserCheck size={16} /></span>
                    <div className="min-w-0">
                      <h2 className="truncate text-base font-black text-white">{row.name || "Admin"}</h2>
                      <p className="truncate text-sm font-bold text-slate-400">{row.email}</p>
                    </div>
                  </div>
                  <p className="mt-2 truncate text-xs font-bold uppercase tracking-wide text-emerald-200">{row.studio?.name ?? "Khong ro studio"}</p>
                  <div className="mt-2 grid grid-cols-2 gap-1 text-center text-[11px] font-black text-slate-300 sm:grid-cols-4">
                    <span className="rounded-xl bg-white/5 px-2 py-1 ring-1 ring-white/10">{row.counts?.customers ?? 0} khach</span>
                    <span className="rounded-xl bg-white/5 px-2 py-1 ring-1 ring-white/10">{row.counts?.bookings ?? 0} booking</span>
                    <span className="rounded-xl bg-white/5 px-2 py-1 ring-1 ring-white/10">{row.counts?.transactions ?? 0} thu chi</span>
                    <span className="rounded-xl bg-white/5 px-2 py-1 ring-1 ring-white/10">{row.counts?.invoices ?? 0} hoa don</span>
                  </div>
                </div>
                <div className="grid gap-2 sm:w-40">
                  <Button className="min-h-11 rounded-2xl bg-emerald-400 text-[#03140C] hover:bg-emerald-300" onClick={() => void viewAsAdmin(row)}>
                    <Eye size={16} />
                    Vao xem
                  </Button>
                  <Button variant="secondary" className="min-h-11 rounded-2xl border-slate-500/30 bg-slate-900 text-slate-100 hover:bg-slate-800" onClick={() => setDeleteTarget(row)}>
                    <Trash2 size={16} />
                    Xoa admin
                  </Button>
                </div>
              </div>
            </Card>
          )) : (
            <Card className="rounded-[1.5rem] border-white/10 bg-white/[0.04] p-6 text-center">
              <p className="text-sm font-bold text-slate-300">Chua co admin ma moi nao khac.</p>
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
                  <h3 className="text-lg font-black text-white">Xoa admin</h3>
                  <p className="mt-1 text-sm font-semibold leading-6 text-slate-300">
                    Xoa quyen dang nhap admin <span className="font-black text-emerald-100">{deleteTarget.email}</span>? Du lieu studio cua admin do khong bi xoa.
                  </p>
                </div>
              </div>
              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                <Button variant="secondary" className="h-11 rounded-xl border-slate-500/30 bg-slate-900 text-slate-100 hover:bg-slate-800" onClick={() => setDeleteTarget(null)} disabled={deleting}>
                  Huy
                </Button>
                <Button className="h-11 rounded-xl bg-emerald-400 text-[#03140C] hover:bg-emerald-300" onClick={() => void deleteAdmin()} disabled={deleting}>
                  {deleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                  Xoa admin
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
