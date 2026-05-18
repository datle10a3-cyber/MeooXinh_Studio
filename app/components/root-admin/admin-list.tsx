"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { AlertModal } from "@/app/components/ui/alert-modal";
import { Button } from "@/app/components/ui/button";
import { Card } from "@/app/components/ui/card";
import { DeleteConfirmation } from "@/app/components/ui/delete-confirmation";
import { PageSpinner } from "@/app/components/ui/skeleton";
import { useUiStore } from "@/app/store/ui-store";
import type { CurrentSession } from "@/app/types/auth";

type AdminRow = {
  id: string;
  name: string;
  email: string;
  status: string;
  createdAt: string;
  lastLoginAt?: string | null;
  studio?: { id: string; name: string; slug: string } | null;
};

type ApiResult<T> = { data?: T; error?: { message: string } };

export function RootAdminList() {
  const router = useRouter();
  const setSession = useUiStore((state) => state.setSession);
  const [rows, setRows] = useState<AdminRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdminRow | null>(null);
  const [message, setMessage] = useState("");

  async function loadRows() {
    setLoading(true);
    const result = await fetch("/api/root-admin/admins").then((res) => res.json() as Promise<ApiResult<AdminRow[]>>);
    if (result.data) setRows(result.data);
    if (result.error) setMessage(result.error.message);
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

  if (loading) return <PageSpinner label="Đang tải danh sách admin..." />;

  return (
    <div className="space-y-3">
      <div className="rounded-[1.5rem] border border-[#F4C7C4] bg-white p-4 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-[#EA7188]">Admin chính</p>
        <h1 className="mt-1 text-2xl font-black text-[#5B342C]">Quản lý admin</h1>
      </div>

      <AlertModal isOpen={!!message} message={message} onClose={() => setMessage("")} />

      <section className="grid gap-3">
        {rows.length ? rows.map((row) => (
          <Card key={row.id} className="rounded-[1.25rem] border-[#F4C7C4] bg-white p-3 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <h2 className="truncate text-base font-black text-[#5B342C]">{row.name || "Admin"}</h2>
                <p className="truncate text-sm font-bold text-[#9B746B]">{row.email}</p>
                <p className="mt-1 truncate text-xs font-bold text-[#7B554D]">{row.studio?.name ?? "Không rõ studio"}</p>
              </div>
              <div className="grid gap-2 sm:w-40">
                <Button className="min-h-11 rounded-2xl" onClick={() => void viewAsAdmin(row)}>
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
