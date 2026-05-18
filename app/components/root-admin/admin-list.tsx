"use client";

import { useEffect, useState } from "react";
import { Loader2, ShieldCheck, Trash2 } from "lucide-react";
import { AlertModal } from "@/app/components/ui/alert-modal";
import { Button } from "@/app/components/ui/button";
import { Card } from "@/app/components/ui/card";
import { DeleteConfirmation } from "@/app/components/ui/delete-confirmation";
import { StudioBrandPanel } from "@/app/components/brand/studio-brand";
import { PageSpinner } from "@/app/components/ui/skeleton";
import { formatDate } from "@/app/utils/format";

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

  if (loading) return <PageSpinner label="Đang tải danh sách admin..." />;

  return (
    <div className="space-y-5">
      <StudioBrandPanel
        eyebrow="Admin chính"
        title="Quản lý danh sách admin"
        description="Chỉ admin chính thấy mục này. Admin đăng ký bằng mã mời vẫn giữ nguyên quyền hiện tại cho tới khi bị xóa khỏi danh sách."
      />

      <AlertModal isOpen={!!message} message={message} onClose={() => setMessage("")} />

      <section className="grid gap-3">
        {rows.length ? rows.map((row) => (
          <Card key={row.id} className="rounded-[1.5rem] border-[#F4C7C4] bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#FFF0F4] text-[#EA7188]">
                    <ShieldCheck size={18} />
                  </span>
                  <div className="min-w-0">
                    <h2 className="truncate text-base font-black text-[#5B342C]">{row.name || "Admin"}</h2>
                    <p className="truncate text-sm font-bold text-[#9B746B]">{row.email}</p>
                  </div>
                </div>
                <div className="mt-3 grid gap-2 text-xs font-bold text-[#7B554D] sm:grid-cols-3">
                  <span className="rounded-2xl bg-[#FFF8F1] px-3 py-2">Studio: {row.studio?.name ?? "Không rõ"}</span>
                  <span className="rounded-2xl bg-[#FFF8F1] px-3 py-2">Tạo: {formatDate(row.createdAt)}</span>
                  <span className="rounded-2xl bg-[#FFF8F1] px-3 py-2">Đăng nhập: {row.lastLoginAt ? formatDate(row.lastLoginAt) : "Chưa có"}</span>
                </div>
              </div>
              <Button variant="danger" className="min-h-11 rounded-2xl" onClick={() => setDeleteTarget(row)}>
                <Trash2 size={16} />
                Xóa admin
              </Button>
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
