"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { FolderOpen, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { DetailModal } from "@/app/components/ui/detail-modal";
import { Card, CardTitle } from "@/app/components/ui/card";
import { DeleteConfirmation } from "@/app/components/ui/delete-confirmation";
import { StudioBrandPanel } from "@/app/components/brand/studio-brand";
import { Input, Textarea } from "@/app/components/ui/input";
import { ProgressiveListSentinel, useProgressiveList } from "@/app/components/ui/progressive-list";
import type { ApiResult, CategoryItem } from "@/app/components/catalog/types";
import { formatDate } from "@/app/utils/format";
import { useUiStore } from "@/app/store/ui-store";
import { PageSpinner } from "@/app/components/ui/skeleton";
import { AlertModal } from "@/app/components/ui/alert-modal";
import { Portal } from "@/app/components/ui/portal";

const emptyForm = { name: "", description: "" };

export function CategoryPage() {
  const [rows, setRows] = useState<CategoryItem[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [detail, setDetail] = useState<CategoryItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CategoryItem | null>(null);
  const [bulkDeleteMode, setBulkDeleteMode] = useState<"selected" | "all" | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [longPressTimer, setLongPressTimer] = useState<number | null>(null);
  const [longPressActivated, setLongPressActivated] = useState(false);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const [editStudioPassword, setEditStudioPassword] = useState("");
  const focusedItemId = useUiStore((state) => state.focusedItemId);
  const role = useUiStore((state) => state.session?.user.role ?? null);
  const setFocusedItemId = useUiStore((state) => state.setFocusedItemId);
  const [initialLoading, setInitialLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  async function loadRows() {
    const result = await fetch("/api/categories").then((res) => res.json() as Promise<ApiResult<CategoryItem[]>>);
    if (result.data) setRows(result.data);
    if (result.error && !/chưa đăng nhập/i.test(result.error.message)) setMessage(result.error.message);
    setInitialLoading(false);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void loadRows(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (showForm) {
      document.body.classList.add("studio-modal-open");
      return () => {
        document.body.classList.remove("studio-modal-open");
      };
    } else {
      document.body.classList.remove("studio-modal-open");
    }
  }, [showForm]);

  useEffect(() => {
    if (!focusedItemId || !rows.length) return;
    const timer = window.setTimeout(() => {
      const element = document.querySelector(`[data-row-id="${CSS.escape(focusedItemId)}"]`);
      element?.scrollIntoView({ behavior: "smooth", block: "center" });
      element?.classList.add("studio-focus-highlight");
      window.setTimeout(() => {
        element?.classList.remove("studio-focus-highlight");
        setFocusedItemId(null);
      }, 2800);
    }, 120);
    return () => window.clearTimeout(timer);
  }, [focusedItemId, rows, setFocusedItemId]);

  async function save() {
    const result = await fetch("/api/categories", {
      method: editingId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, id: editingId, ...(editingId && role === "STAFF" ? { studioPassword: editStudioPassword } : {}) }),
    }).then((res) => res.json() as Promise<ApiResult<CategoryItem>>);
    if (result.error) return setMessage(result.error.message);
    setForm(emptyForm);
    setEditingId(null);
    setEditStudioPassword("");
    setShowForm(false);
    setMessage(editingId ? "Đã cập nhật danh mục." : "Đã tạo danh mục.");
    void loadRows();
  }

  async function remove(row: CategoryItem, mode: "trash" | "hard") {
    const studioPassword = role === "MANAGER" ? window.prompt("Nhập mật khẩu xóa ca 6 số để xóa danh mục.")?.trim() ?? "" : "";
    if (role === "MANAGER" && !/^\d{6}$/.test(studioPassword)) {
      setMessage("Mật khẩu xóa ca phải gồm 6 số.");
      return;
    }
    setDeleting(true);
    try {
      const result = await fetch("/api/categories", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: row.id, mode, ...(studioPassword ? { studioPassword } : {}) }),
      }).then((res) => res.json() as Promise<ApiResult<{ id: string }>>);
      if (result.error) return setMessage(result.error.message);
      setMessage(mode === "hard" ? "Đã xóa danh mục." : "Đã chuyển danh mục vào thùng rác.");
      setDetail(null);
      setDeleteTarget(null);
      setSelectedIds((current) => current.filter((id) => id !== row.id));
      await loadRows();
    } finally {
      setDeleting(false);
    }
  }

  async function removeMany(mode: "trash" | "hard") {
    const studioPassword = role === "MANAGER" ? window.prompt("Nhập mật khẩu xóa ca 6 số để xóa danh mục.")?.trim() ?? "" : "";
    if (role === "MANAGER" && !/^\d{6}$/.test(studioPassword)) {
      setMessage("Mật khẩu xóa ca phải gồm 6 số.");
      return;
    }
    setDeleting(true);
    try {
      const source = bulkDeleteMode === "all" ? filteredRows : filteredRows.filter((row) => selectedIds.includes(row.id));
      for (const row of source) {
        const result = await fetch("/api/categories", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: row.id, mode, ...(studioPassword ? { studioPassword } : {}) }),
        }).then((res) => res.json() as Promise<ApiResult<{ id: string }>>);
        if (result.error) {
          setMessage(result.error.message);
          setBulkDeleteMode(null);
          return;
        }
      }
      setMessage(mode === "hard" ? `Đã xóa ${source.length} danh mục.` : `Đã chuyển ${source.length} danh mục vào thùng rác.`);
      setSelectedIds([]);
      setBulkDeleteMode(null);
      await loadRows();
    } finally {
      setDeleting(false);
    }
  }

  function startCreate() {
    setEditingId(null);
    setEditStudioPassword("");
    setForm(emptyForm);
    setShowForm(true);
  }

  function edit(row: CategoryItem) {
    let studioPassword = "";
    if (role === "STAFF") {
      studioPassword = window.prompt("Nhập mật khẩu studio 6 số để sửa danh mục.")?.trim() ?? "";
      if (!/^\d{6}$/.test(studioPassword)) {
        setMessage("Nhân viên cần nhập đúng mật khẩu studio 6 số để sửa danh mục.");
        return;
      }
    }
    setDetail(null);
    setEditingId(row.id);
    setEditStudioPassword(studioPassword);
    setForm({ name: row.name, description: row.description ?? "" });
    setShowForm(true);
  }

  const deferredQuery = useDeferredValue(query);
  const filteredRows = useMemo(() => {
    const keyword = deferredQuery.trim().toLowerCase();
    if (!keyword) return rows;
    return rows.filter((row) => [row.name, row.description].some((value) => String(value ?? "").toLowerCase().includes(keyword)));
  }, [rows, deferredQuery]);
  const progressiveRows = useProgressiveList(filteredRows, 30);
  const allVisibleSelected = filteredRows.length > 0 && filteredRows.every((row) => selectedIds.includes(row.id));

  function toggleSelect(id: string) {
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function clearLongPress() {
    if (longPressTimer !== null) {
      window.clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  }

  function beginLongPress(id: string) {
    clearLongPress();
    const timer = window.setTimeout(() => {
      toggleSelect(id);
      setLongPressActivated(true);
      setLongPressTimer(null);
    }, 430);
    setLongPressTimer(timer);
  }

  function startLongPress(event: React.PointerEvent, id: string) {
    if (event.pointerType !== "mouse") return;
    const target = event.target as HTMLElement;
    const currentTarget = event.currentTarget as HTMLElement;
    const interactive = target.closest("button,a,input,select,textarea");
    if (interactive && interactive !== currentTarget) return;
    beginLongPress(id);
  }

  function startTouchLongPress(event: React.TouchEvent, id: string) {
    const target = event.target as HTMLElement;
    const currentTarget = event.currentTarget as HTMLElement;
    const interactive = target.closest("button,a,input,select,textarea");
    if (interactive && interactive !== currentTarget) return;
    const touch = event.touches[0];
    if (touch.clientX < 28 || touch.clientX > window.innerWidth - 28) return;
    touchStart.current = { x: touch.clientX, y: touch.clientY };
    beginLongPress(id);
  }

  function moveTouchLongPress(event: React.TouchEvent) {
    if (!touchStart.current) return;
    const touch = event.touches[0];
    if (Math.abs(touch.clientX - touchStart.current.x) > 12 || Math.abs(touch.clientY - touchStart.current.y) > 12) {
      touchStart.current = null;
      clearLongPress();
    }
  }

  function endTouchLongPress() {
    touchStart.current = null;
    clearLongPress();
  }

  return (
    <div className="mx-auto max-w-[1500px] space-y-5">
      <StudioBrandPanel
        eyebrow="Booking"
        title="Danh mục"
        description="Tạo nhóm dịch vụ để gói chụp và booking đi theo đúng luồng."
        actions={
          role !== "STAFF" ? <Button className="w-full sm:w-auto" onClick={startCreate}>
            <Plus size={17} />
            Thêm danh mục
          </Button> : null
        }
      />
      <section className="hidden">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-[#E88498] sm:text-sm">Studio Mèo Xinhh</p>
          <h1 className="mt-1 text-2xl font-black text-[#5B342C] sm:text-3xl">Danh mục</h1>
        </div>
        <Button className="w-full sm:w-auto" onClick={startCreate}>
          <Plus size={17} />
          Thêm danh mục
        </Button>
      </section>

      <AlertModal isOpen={!!message} message={message} onClose={() => setMessage("")} />

      <div className="flex items-center gap-2 rounded-2xl border border-[#F4C7C4] bg-white px-4 py-3 shadow-sm">
        <Search size={18} className="shrink-0 text-[#EA7188]" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Tìm danh mục..."
          className="h-8 min-w-0 flex-1 bg-transparent text-sm font-semibold text-[#5B342C] outline-none placeholder:text-[#B98278]"
        />
      </div>

      {selectedIds.length > 0 && filteredRows.length > 0 && (role === "ADMIN" || role === "MANAGER") ? (
        <div className="flex flex-col gap-2 rounded-2xl border border-[#F4C7C4] bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <label className="flex items-center gap-2 text-sm font-black text-[#5B342C]">
            <input
              type="checkbox"
              className="h-4 w-4 accent-[#EA7188]"
              checked={allVisibleSelected}
              onChange={(event) => setSelectedIds(event.target.checked ? filteredRows.map((row) => row.id) : [])}
            />
            Chọn tất cả ({filteredRows.length})
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
      ) : null}

      {(() => {
        if (!showForm) return null;
        const formElement = (
          <div ref={formRef} className="scroll-mt-20">
            <button className="studio-mobile-form-backdrop sm:hidden" aria-label="Đóng form" onClick={() => setShowForm(false)} />
            <Card className="studio-mobile-form-sheet">
              <div className="mb-4 flex items-center justify-between gap-3">
                <CardTitle>{editingId ? "Sửa danh mục" : "Thêm danh mục"}</CardTitle>
                <Button variant="secondary" size="icon" aria-label="Đóng form" onClick={() => setShowForm(false)}>
                  <X size={16} />
                </Button>
              </div>
              <div className="grid gap-3 md:grid-cols-[1fr_1.5fr_auto] md:items-start">
                <Input placeholder="Tên danh mục" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
                <Textarea placeholder="Mô tả" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
                <Button className="min-h-11" onClick={save}>{editingId ? "Cập nhật" : "Lưu"}</Button>
              </div>
              {/* Thêm khoảng trống ở cuối để không bị che bởi menu/nav bar điện thoại */}
              <div className="h-20 sm:hidden" />
            </Card>
          </div>
        );
        return isMobile ? <Portal>{formElement}</Portal> : formElement;
      })()}

      <div className="grid gap-3">
        {progressiveRows.visibleItems.map((row, index) => (
          <button
            key={row.id}
            data-row-id={row.id}
            onClick={() => {
              if (longPressActivated) {
                setLongPressActivated(false);
                return;
              }
              setDetail(row);
            }}
            onPointerDown={(event) => startLongPress(event, row.id)}
            onPointerUp={clearLongPress}
            onPointerCancel={clearLongPress}
            onPointerLeave={clearLongPress}
            onTouchStart={(event) => startTouchLongPress(event, row.id)}
            onTouchMove={moveTouchLongPress}
            onTouchEnd={endTouchLongPress}
            onTouchCancel={endTouchLongPress}
            className="rounded-[1.35rem] border border-[#F4C7C4] bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#EA7188] hover:shadow-md sm:rounded-[1.5rem] sm:p-5"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3 sm:gap-4">
                {selectedIds.length > 0 || selectedIds.includes(row.id) ? (
                  <span
                    role="checkbox"
                    aria-checked={selectedIds.includes(row.id)}
                    tabIndex={0}
                    onClick={(event) => {
                      event.stopPropagation();
                      toggleSelect(row.id);
                    }}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter" && event.key !== " ") return;
                      event.preventDefault();
                      event.stopPropagation();
                      toggleSelect(row.id);
                    }}
                    className={[
                      "grid h-9 w-9 shrink-0 place-items-center rounded-xl border text-xs font-black transition sm:h-10 sm:w-10 sm:rounded-2xl sm:text-sm",
                      selectedIds.includes(row.id) ? "border-[#EA7188] bg-[#EA7188] text-white shadow-[0_0_0_4px_rgba(234,113,136,0.18)] scale-105" : "border-[#F4C7C4] bg-white text-[#EA7188]",
                    ].join(" ")}
                  >
                    {selectedIds.includes(row.id) ? "✓" : ""}
                  </span>
                ) : (
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-[#F4C7C4] bg-[#FFF3EC] text-xs font-black text-[#5B342C] sm:h-10 sm:w-10 sm:rounded-2xl sm:text-sm">{filteredRows.length - index}</span>
                )}
                <span
                  role="checkbox"
                  aria-checked={selectedIds.includes(row.id)}
                  tabIndex={0}
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelectedIds((current) => current.includes(row.id) ? current.filter((id) => id !== row.id) : [...current, row.id]);
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" && event.key !== " ") return;
                    event.preventDefault();
                    event.stopPropagation();
                    setSelectedIds((current) => current.includes(row.id) ? current.filter((id) => id !== row.id) : [...current, row.id]);
                  }}
                  className="hidden"
                >
                  {selectedIds.includes(row.id) ? "✓" : ""}
                </span>
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#FFF3EC] text-[#5B342C] sm:h-12 sm:w-12">
                  <FolderOpen size={21} />
                </div>
                <div className="min-w-0">
                  <h2 className="whitespace-normal break-words text-base font-black leading-6 text-[#5B342C] sm:text-lg">{row.name}</h2>
                  <p className="mt-1 whitespace-normal break-words text-sm font-medium leading-5 text-[#9B746B]">{row.description || "Không có mô tả"}</p>
                </div>
              </div>
              <div className="flex shrink-0 items-start gap-2">
                <p className="hidden text-xs font-bold text-[#9B746B] sm:block">{formatDate(row.createdAt)}</p>
                <span
                  role="checkbox"
                  aria-checked={selectedIds.includes(row.id)}
                  tabIndex={0}
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelectedIds((current) => current.includes(row.id) ? current.filter((id) => id !== row.id) : [...current, row.id]);
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" && event.key !== " ") return;
                    event.preventDefault();
                    event.stopPropagation();
                    setSelectedIds((current) => current.includes(row.id) ? current.filter((id) => id !== row.id) : [...current, row.id]);
                  }}
                  className="hidden"
                >
                  {selectedIds.includes(row.id) ? "✓" : ""}
                </span>
              </div>
            </div>
          </button>
        ))}
        <ProgressiveListSentinel refTarget={progressiveRows.sentinelRef} hasMore={progressiveRows.hasMore} />
        {initialLoading && filteredRows.length === 0 ? (
          <PageSpinner label="Đang tải danh mục…" />
        ) : filteredRows.length === 0 ? (
          <Card className="py-12 text-center font-bold text-[#9B746B]">{query ? "Không tìm thấy danh mục" : "Chưa có danh mục"}</Card>
        ) : null}
      </div>

      {detail ? (
        <CategoryDetailModal
          category={detail}
          onClose={() => setDetail(null)}
          onEdit={() => edit(detail)}
          onRemove={role === "ADMIN" || role === "MANAGER" ? () => setDeleteTarget(detail) : undefined}
        />
      ) : null}

      <DeleteConfirmation
        open={Boolean(deleteTarget)}
        description={`Bạn có chắc chắn muốn xóa danh mục "${deleteTarget?.name ?? ""}"?`}
        onHardDelete={() => deleteTarget ? void remove(deleteTarget, "hard") : undefined}
        onMoveToTrash={() => deleteTarget ? void remove(deleteTarget, "trash") : undefined}
        onCancel={() => deleting ? undefined : setDeleteTarget(null)}
        loading={deleting}
      />
      <DeleteConfirmation
        open={Boolean(bulkDeleteMode)}
        description={bulkDeleteMode === "all" ? `Bạn có chắc chắn muốn xóa tất cả ${filteredRows.length} danh mục đang hiển thị?` : `Bạn có chắc chắn muốn xóa ${selectedIds.length} danh mục đã chọn?`}
        onHardDelete={() => void removeMany("hard")}
        onMoveToTrash={() => void removeMany("trash")}
        onCancel={() => deleting ? undefined : setBulkDeleteMode(null)}
        loading={deleting}
      />
    </div>
  );
}

function CategoryDetailModal({
  category,
  onClose,
  onEdit,
  onRemove,
}: {
  category: CategoryItem;
  onClose: () => void;
  onEdit: () => void;
  onRemove?: () => void;
}) {
  return (
    <DetailModal
      onClose={onClose}
      maxWidth="max-w-xl"
      header={
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#FFF3EC] text-[#EA7188]">
            <FolderOpen size={22} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#EA7188]">Chi tiết danh mục</p>
            <h2 className="mt-1 whitespace-normal break-words text-xl font-black leading-7 text-[#5B342C] sm:text-2xl sm:leading-8">{category.name}</h2>
          </div>
        </div>
      }
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" className="min-h-11" onClick={onEdit}>
            <Pencil size={16} />
            Sửa
          </Button>
          {onRemove ? (
            <Button variant="danger" className="min-h-11" onClick={onRemove}>
              <Trash2 size={16} />
              Xóa
            </Button>
          ) : null}
        </div>
      }
    >
      <div className="grid gap-3">
        <DetailBox label="Tên" value={category.name} />
        <DetailBox label="Mô tả" value={category.description || "Không có"} />
        <DetailBox label="Ngày tạo" value={formatDate(category.createdAt)} />
      </div>
    </DetailModal>
  );
}

function DetailBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.25rem] border border-[#F4C7C4] bg-[#FFFDFB] p-4">
      <p className="text-xs font-black uppercase tracking-[0.12em] text-[#9B746B]">{label}</p>
      <p className="mt-2 whitespace-normal break-words text-sm font-black leading-6 text-[#5B342C]">{value}</p>
    </div>
  );
}
