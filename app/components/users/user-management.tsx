"use client";

import { useEffect, useRef, useState } from "react";
import { BadgeCheck, BriefcaseBusiness, KeyRound, Mail, Pencil, Phone, ShieldCheck, Trash2, UserPlus, X } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Card, CardTitle } from "@/app/components/ui/card";
import { DeleteConfirmation } from "@/app/components/ui/delete-confirmation";
import { StudioBrandPanel } from "@/app/components/brand/studio-brand";
import { Input, Textarea } from "@/app/components/ui/input";
import { MediaGalleryPicker } from "@/app/components/media/media-picker";
import { ImagePreview } from "@/app/components/media/image-preview";
import { formatMoney } from "@/app/utils/format";

type StaffRow = {
  id: string;
  userId?: string | null;
  name: string;
  email?: string | null;
  phone?: string | null;
  position: string;
  address?: string | null;
  salaryType: string;
  baseSalary: string | number;
  workSchedule?: string | null;
  note?: string | null;
  avatarUrl?: string | null;
  galleryUrls?: string | null;
  role: "ADMIN" | "MANAGER" | "STAFF";
  status: string;
};

type ApiResult<T> = { data?: T; error?: { message: string } };

const emptyForm = {
  id: "",
  name: "",
  email: "",
  phone: "",
  position: "Nhân viên",
  address: "",
  salaryType: "FIXED",
  baseSalary: "0",
  workSchedule: "",
  note: "",
  avatarUrl: "",
  galleryUrls: "[]",
  createAccount: false,
  password: "",
  role: "STAFF",
  status: "ACTIVE",
};

function gallery(value?: string | null) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string").slice(0, 4) : [];
  } catch {
    return [];
  }
}

function staffImages(row: StaffRow) {
  return [row.avatarUrl, ...gallery(row.galleryUrls)].filter((item): item is string => Boolean(item));
}

function roleLabel(role: string) {
  if (role === "ADMIN") return "Quản trị";
  if (role === "MANAGER") return "Quản lý";
  return "Nhân viên";
}

export function UserManagement() {
  const [rows, setRows] = useState<StaffRow[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [preview, setPreview] = useState<{ images: string[]; index: number; alt: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StaffRow | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkDeleteMode, setBulkDeleteMode] = useState<"selected" | "all" | null>(null);
  const [longPressTimer, setLongPressTimer] = useState<number | null>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const editing = Boolean(form.id);

  async function loadRows() {
    const result = await fetch("/api/users").then((res) => res.json() as Promise<ApiResult<StaffRow[]>>);
    if (result.data) setRows(result.data);
    if (result.error) setMessage(result.error.message);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void loadRows(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!showForm) return;
    const frame = window.requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [showForm]);

  async function save() {
    const result = await fetch("/api/users", {
      method: editing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    }).then((res) => res.json() as Promise<ApiResult<StaffRow>>);
    if (result.error) return setMessage(result.error.message);
    setForm(emptyForm);
    setShowForm(false);
    setMessage(editing ? "Đã cập nhật nhân viên." : "Đã thêm nhân viên.");
    void loadRows();
  }

  async function remove(row: StaffRow, mode: "trash" | "hard") {
    const result = await fetch("/api/users", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: row.id, mode }),
    }).then((res) => res.json() as Promise<ApiResult<{ id: string }>>);
    if (result.error) return setMessage(result.error.message);
    setMessage(mode === "hard" ? "Đã xóa nhân viên." : "Đã chuyển nhân viên vào thùng rác.");
    setDeleteTarget(null);
    setSelectedIds((current) => current.filter((id) => id !== row.id));
    void loadRows();
  }

  async function removeMany(mode: "trash" | "hard") {
    const source = bulkDeleteMode === "all" ? rows : rows.filter((row) => selectedIds.includes(row.id));
    for (const row of source) {
      const result = await fetch("/api/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: row.id, mode }),
      }).then((res) => res.json() as Promise<ApiResult<{ id: string }>>);
      if (result.error) {
        setMessage(result.error.message);
        setBulkDeleteMode(null);
        return;
      }
    }
    setMessage(mode === "hard" ? `Đã xóa ${source.length} nhân viên.` : `Đã chuyển ${source.length} nhân viên vào thùng rác.`);
    setSelectedIds([]);
    setBulkDeleteMode(null);
    void loadRows();
  }

  function edit(row: StaffRow) {
    setShowForm(true);
    setForm({
      id: row.id,
      name: row.name,
      email: row.email ?? "",
      phone: row.phone ?? "",
      position: row.position ?? "Nhân viên",
      address: row.address ?? "",
      salaryType: row.salaryType ?? "FIXED",
      baseSalary: String(row.baseSalary ?? 0),
      workSchedule: row.workSchedule ?? "",
      note: row.note ?? "",
      avatarUrl: row.avatarUrl ?? "",
      galleryUrls: row.galleryUrls ?? "[]",
      createAccount: Boolean(row.userId),
      password: "",
      role: row.role ?? "STAFF",
      status: row.status === "NO_ACCOUNT" ? "ACTIVE" : row.status,
    });
  }

  function openStaffGallery(row: StaffRow, index: number) {
    const images = staffImages(row);
    if (!images.length) return;
    setPreview({ images, index, alt: row.name });
  }
  const allVisibleSelected = rows.length > 0 && rows.every((row) => selectedIds.includes(row.id));

  function toggleSelect(id: string) {
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function clearLongPress() {
    if (longPressTimer !== null) {
      window.clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  }

  function startLongPress(event: React.PointerEvent, id: string) {
    const target = event.target as HTMLElement;
    const currentTarget = event.currentTarget as HTMLElement;
    if (event.pointerType === "touch" && (event.clientX < 28 || event.clientX > window.innerWidth - 28)) return;
    if (target !== currentTarget && target.closest("button,a,input,select,textarea")) return;
    clearLongPress();
    const timer = window.setTimeout(() => {
      toggleSelect(id);
      setLongPressTimer(null);
    }, 520);
    setLongPressTimer(timer);
  }

  return (
    <div className="space-y-5">
      <StudioBrandPanel
        eyebrow="Hồ sơ + tài khoản"
        title="Nhân sự"
        description="Tạo nhân viên, ảnh đại diện, lương và tài khoản đăng nhập trong cùng một màn hình."
        actions={
          !showForm ? (
            <Button className="w-full sm:w-auto" onClick={() => { setForm(emptyForm); setShowForm(true); }}>
              <UserPlus size={17} />
              Thêm nhân viên
            </Button>
          ) : null
        }
      />
      <section className="hidden">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-[#FFF3EC] px-3 py-1 text-sm font-semibold text-[#9B746B]">
              <BriefcaseBusiness size={15} />
              Hồ sơ + tài khoản
            </p>
            <h1 className="mt-3 text-3xl font-bold text-[#5B342C]">Nhân sự</h1>
          </div>
          <p className="max-w-md text-sm leading-6 text-[#9B746B]">Tạo nhân viên, ảnh đại diện, lương và tài khoản đăng nhập trong cùng một màn hình.</p>
        </div>
      </section>

      {message ? <p className="rounded-xl border border-[#F4C7C4] bg-white px-4 py-3 text-sm text-[#5B342C]">{message}</p> : null}

      {false && !showForm ? (
        <div className="flex justify-end">
          <Button className="w-full sm:w-auto" onClick={() => { setForm(emptyForm); setShowForm(true); }}>
            <UserPlus size={17} />
            Thêm nhân viên
          </Button>
        </div>
      ) : null}

      <div className={showForm ? "grid items-start gap-5 xl:grid-cols-[1fr_460px]" : "grid items-start gap-5"}>
        <div className="grid items-start gap-4 lg:grid-cols-2">
          {rows.length ? (
            <div className="rounded-2xl border border-[#F4C7C4] bg-white p-3 shadow-sm lg:col-span-2">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <label className="flex items-center gap-2 text-sm font-black text-[#5B342C]">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-[#EA7188]"
                    checked={allVisibleSelected}
                    onChange={(event) => setSelectedIds(event.target.checked ? rows.map((row) => row.id) : [])}
                  />
                  Chọn tất cả ({rows.length})
                </label>
                <div className="grid grid-cols-2 gap-2 sm:flex">
                  <Button variant="secondary" size="sm" disabled={!selectedIds.length} onClick={() => setBulkDeleteMode("selected")}>
                    Xóa đã chọn ({selectedIds.length})
                  </Button>
                  <Button variant="danger" size="sm" onClick={() => setBulkDeleteMode("all")}>
                    Xóa tất cả
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
          {rows.map((row, index) => {
            const thumbs = gallery(row.galleryUrls);
            return (
              <Card
                key={row.id}
                onPointerDown={(event) => startLongPress(event, row.id)}
                onPointerUp={clearLongPress}
                onPointerCancel={clearLongPress}
                onPointerLeave={clearLongPress}
                className="flex h-fit flex-col space-y-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {selectedIds.length > 0 || selectedIds.includes(row.id) ? (
                      <button
                        type="button"
                        onClick={() => toggleSelect(row.id)}
                        className={[
                          "grid h-10 w-10 shrink-0 place-items-center rounded-2xl border text-sm font-black transition",
                          selectedIds.includes(row.id) ? "border-[#EA7188] bg-[#EA7188] text-white shadow-[0_0_0_4px_rgba(234,113,136,0.18)] scale-105" : "border-[#F4C7C4] bg-white text-[#EA7188]",
                        ].join(" ")}
                        aria-label="Chọn nhân viên"
                      >
                        {selectedIds.includes(row.id) ? "✓" : ""}
                      </button>
                    ) : (
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-[#F4C7C4] bg-[#FFF3EC] text-sm font-black text-[#5B342C]">
                        {rows.length - index}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => toggleSelect(row.id)}
                      className="hidden"
                      aria-label="Chọn nhân viên"
                    >
                      {selectedIds.includes(row.id) ? "✓" : ""}
                    </button>
                    {row.avatarUrl ? (
                      <button type="button" onClick={() => openStaffGallery(row, 0)} className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-[#FFF3EC]">
                        <img src={row.avatarUrl} alt={row.name} className="max-h-full max-w-full object-contain p-1" />
                      </button>
                    ) : (
                      <div className="grid h-16 w-16 place-items-center rounded-2xl bg-[#EA7188] text-xl font-black text-[#5B342C]">
                        {row.name.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <h2 className="text-lg font-bold text-[#5B342C]">{row.name}</h2>
                      <p className="text-sm text-[#9B746B]">{row.position}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="secondary" size="icon" aria-label="Sửa" onClick={() => edit(row)}>
                      <Pencil size={16} />
                    </Button>
                    <Button variant="danger" size="icon" aria-label="Xóa" onClick={() => setDeleteTarget(row)}>
                      <Trash2 size={16} />
                    </Button>
                    <button
                      type="button"
                      onClick={() => toggleSelect(row.id)}
                      className="hidden"
                      aria-label="Chọn nhân viên"
                    >
                      {selectedIds.includes(row.id) ? "✓" : ""}
                    </button>
                  </div>
                </div>

                {thumbs.length ? (
                  <div className="rounded-2xl border border-[#F4C7C4] bg-[#FFF0F4] p-2">
                    <div className="grid grid-cols-4 gap-2">
                      {thumbs.map((url, index) => (
                        <button
                          key={`${url}-${index}`}
                          type="button"
                          onClick={() => openStaffGallery(row, thumbIndex(row, url))}
                          className="flex h-20 items-center justify-center overflow-hidden rounded-xl border border-[#F4C7C4] bg-white transition hover:scale-[1.02] hover:shadow-sm"
                        >
                          <img src={url} alt="" className="max-h-full max-w-full object-contain p-1" />
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="grid gap-2 text-sm text-[#5B342C]">
                  <p className="flex items-center gap-2"><Mail size={15} className="text-[#EA7188]" />{row.email || "Chưa có email"}</p>
                  <p className="flex items-center gap-2"><Phone size={15} className="text-[#EA7188]" />{row.phone || "Chưa có số điện thoại"}</p>
                  <p className="flex items-center gap-2"><BriefcaseBusiness size={15} className="text-[#EA7188]" />{row.address || "Chưa có địa chỉ"}</p>
                  <p className="flex items-center gap-2"><ShieldCheck size={15} className="text-[#EA7188]" />{roleLabel(row.role)} · {row.status === "NO_ACCOUNT" ? "Chưa có tài khoản" : row.status}</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-[#FFF3EC] p-3">
                    <p className="text-xs text-[#9B746B]">Lương</p>
                    <p className="font-bold text-[#5B342C]">{formatMoney(row.baseSalary)}</p>
                  </div>
                  <div className="rounded-2xl bg-[#FFF3EC] p-3">
                    <p className="text-xs text-[#9B746B]">Lịch làm</p>
                    <p className="whitespace-normal break-words font-bold leading-5 text-[#5B342C]">{row.workSchedule || "Chưa nhập"}</p>
                  </div>
                </div>

                {row.note ? <p className="rounded-2xl border border-[#F4C7C4] bg-white px-3 py-2 text-sm text-[#9B746B]">{row.note}</p> : null}
              </Card>
            );
          })}

          {rows.length === 0 ? (
            <Card className="py-14 text-center lg:col-span-2">
              <h2 className="text-lg font-bold text-[#5B342C]">Chưa có nhân viên</h2>
              <p className="mt-2 text-sm text-[#9B746B]">Thêm nhân viên đầu tiên bằng form bên phải.</p>
            </Card>
          ) : null}
        </div>

        {showForm ? (
        <div ref={formRef} className="scroll-mt-20">
        <Card className="h-fit xl:sticky xl:top-24">
          <div className="mb-3 flex justify-end">
            <Button variant="secondary" size="icon" aria-label="Đóng form" onClick={() => { setForm(emptyForm); setShowForm(false); }}>
              <X size={16} />
            </Button>
          </div>
          <div className="mb-5 flex items-center gap-2">
            <UserPlus size={20} className="text-[#EA7188]" />
            <CardTitle>{editing ? "Sửa nhân viên" : "Thêm nhân viên"}</CardTitle>
          </div>
          <div className="space-y-4">
            <MediaGalleryPicker
              mainUrl={form.avatarUrl}
              galleryUrls={form.galleryUrls}
              onMainChange={(value) => setForm((current) => ({ ...current, avatarUrl: value }))}
              onGalleryChange={(value) => setForm((current) => ({ ...current, galleryUrls: value }))}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <Input placeholder="Tên nhân viên" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
              <Input placeholder="Chức vụ" value={form.position} onChange={(event) => setForm((current) => ({ ...current, position: event.target.value }))} />
              <Input placeholder="Email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} />
              <Input placeholder="Số điện thoại" value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} />
              <Input className="sm:col-span-2" placeholder="Địa chỉ" value={form.address} onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))} />
              <Input placeholder="Lương" type="number" value={form.baseSalary} onChange={(event) => setForm((current) => ({ ...current, baseSalary: event.target.value }))} />
              <select className="h-12 w-full rounded-xl border border-[#F4C7C4] bg-white px-4 text-sm text-[#5B342C]" value={form.salaryType} onChange={(event) => setForm((current) => ({ ...current, salaryType: event.target.value }))}>
                <option value="FIXED">Lương cố định</option>
                <option value="HOURLY">Theo giờ</option>
                <option value="COMMISSION">Theo hoa hồng</option>
              </select>
            </div>

            <Input placeholder="Lịch làm việc" value={form.workSchedule} onChange={(event) => setForm((current) => ({ ...current, workSchedule: event.target.value }))} />
            <Textarea placeholder="Ghi chú nhân sự" value={form.note} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} />

            <div className="rounded-2xl border border-[#F4C7C4] bg-[#FFF9F4] p-4">
              <label className="flex items-center justify-between gap-3">
                <span>
                  <span className="flex items-center gap-2 font-bold text-[#5B342C]"><KeyRound size={17} />Tài khoản đăng nhập</span>
                  <span className="mt-1 block text-xs text-[#9B746B]">Bật để nhân viên đăng nhập vào hệ thống.</span>
                </span>
                <input
                  type="checkbox"
                  checked={form.createAccount}
                  onChange={(event) => setForm((current) => ({ ...current, createAccount: event.target.checked }))}
                  className="h-5 w-5 accent-[#EA7188]"
                />
              </label>
              {form.createAccount ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <select className="h-12 w-full rounded-xl border border-[#F4C7C4] bg-white px-4 text-sm text-[#5B342C]" value={form.role} onChange={(event) => setForm((current) => ({ ...current, role: event.target.value }))}>
                    <option value="STAFF">Nhân viên</option>
                    <option value="MANAGER">Quản lý</option>
                    <option value="ADMIN">Quản trị</option>
                  </select>
                  <select className="h-12 w-full rounded-xl border border-[#F4C7C4] bg-white px-4 text-sm text-[#5B342C]" value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}>
                    <option value="ACTIVE">Đang hoạt động</option>
                    <option value="INACTIVE">Tạm khóa</option>
                  </select>
                  <Input
                    className="sm:col-span-2"
                    placeholder={editing ? "Mật khẩu mới nếu muốn đổi" : "Mật khẩu tối thiểu 8 ký tự"}
                    type="password"
                    value={form.password}
                    onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                  />
                </div>
              ) : null}
            </div>

            <div className="flex gap-2">
              <Button className="flex-1" onClick={save}>
                <BadgeCheck size={17} />
                {editing ? "Cập nhật" : "Lưu nhân viên"}
              </Button>
              {editing ? <Button variant="secondary" onClick={() => setForm(emptyForm)}>Hủy</Button> : null}
            </div>
          </div>
        </Card>
        </div>
        ) : null}
      </div>
      <ImagePreview
        images={preview?.images}
        index={preview?.index ?? 0}
        alt={preview?.alt}
        onIndexChange={(index) => setPreview((current) => current ? { ...current, index } : current)}
        onClose={() => setPreview(null)}
      />
      <DeleteConfirmation
        open={Boolean(deleteTarget)}
        description={`Bạn có chắc chắn muốn xóa nhân viên "${deleteTarget?.name ?? ""}"? Nếu chuyển vào thùng rác, tài khoản đăng nhập sẽ bị tạm khóa.`}
        onHardDelete={() => deleteTarget ? void remove(deleteTarget, "hard") : undefined}
        onMoveToTrash={() => deleteTarget ? void remove(deleteTarget, "trash") : undefined}
        onCancel={() => setDeleteTarget(null)}
      />
      <DeleteConfirmation
        open={Boolean(bulkDeleteMode)}
        description={bulkDeleteMode === "all" ? `Bạn có chắc chắn muốn xóa tất cả ${rows.length} nhân viên?` : `Bạn có chắc chắn muốn xóa ${selectedIds.length} nhân viên đã chọn?`}
        onHardDelete={() => void removeMany("hard")}
        onMoveToTrash={() => void removeMany("trash")}
        onCancel={() => setBulkDeleteMode(null)}
      />
    </div>
  );
}

function thumbIndex(row: StaffRow, url: string) {
  const images = staffImages(row);
  const index = images.indexOf(url);
  return index >= 0 ? index : 0;
}



