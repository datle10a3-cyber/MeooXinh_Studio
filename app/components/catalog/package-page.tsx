"use client";

import { type Dispatch, type SetStateAction, useRef, useEffect, useState } from "react";
import {
  CheckCircle2,
  Clock,
  Gift,
  ImageIcon,
  MapPin,
  Pencil,
  Plus,
  Search,
  Shirt,
  Trash2,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { DetailModal } from "@/app/components/ui/detail-modal";
import { Card, CardTitle } from "@/app/components/ui/card";
import { DeleteConfirmation } from "@/app/components/ui/delete-confirmation";
import { StudioBrandPanel } from "@/app/components/brand/studio-brand";
import { Input, Textarea } from "@/app/components/ui/input";
import { ProgressiveListSentinel, useProgressiveList } from "@/app/components/ui/progressive-list";
import { MediaGalleryPicker } from "@/app/components/media/media-picker";
import { ImagePreview } from "@/app/components/media/image-preview";
import type { ApiResult, CategoryItem, PackageItem } from "@/app/components/catalog/types";
import { formatMoney } from "@/app/utils/format";
import { useUiStore } from "@/app/store/ui-store";
import { AlertModal } from "@/app/components/ui/alert-modal";
import { PageSpinner } from "@/app/components/ui/skeleton";
import { Portal } from "@/app/components/ui/portal";

const emptyForm = {
  name: "",
  categoryId: "",
  price: "0",
  description: "",
  duration: "",
  suitableFor: "",
  includes: "",
  deliverables: "",
  outfitCount: "",
  peopleCount: "",
  location: "",
  customerNote: "",
  imageUrl: "",
  galleryUrls: "[]",
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

function packageImages(row: PackageItem) {
  return [row.imageUrl, ...gallery(row.galleryUrls)].filter((item): item is string => Boolean(item));
}

function listText(value?: string | null) {
  return String(value ?? "")
    .split(/\n|,|;/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 5);
}

export function PackagePage() {
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [rows, setRows] = useState<PackageItem[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [detail, setDetail] = useState<PackageItem | null>(null);
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState<{ images: string[]; index: number; alt: string } | null>(null);
  const [query, setQuery] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<PackageItem | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkDeleteMode, setBulkDeleteMode] = useState<"selected" | "all" | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [longPressActivated, setLongPressActivated] = useState(false);
  const [editStudioPassword, setEditStudioPassword] = useState("");
  const formRef = useRef<HTMLDivElement>(null);
  const longPressTimer = useRef<number | null>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const role = useUiStore((state) => state.session?.user.role ?? null);
  const focusedItemId = useUiStore((state) => state.focusedItemId);
  const setFocusedItemId = useUiStore((state) => state.setFocusedItemId);
  const [initialLoading, setInitialLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  function clearLongPress() {
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  function beginLongPress(row: PackageItem) {
    clearLongPress();
    longPressTimer.current = window.setTimeout(() => {
      setSelectedIds((current) => current.includes(row.id) ? current : [...current, row.id]);
      setLongPressActivated(true);
      longPressTimer.current = null;
    }, 430);
  }

  function startLongPress(event: React.PointerEvent, row: PackageItem) {
    if (event.pointerType !== "mouse") return;
    const target = event.target as HTMLElement;
    const currentTarget = event.currentTarget as HTMLElement;
    const interactive = target.closest("button,a,input,select,textarea");
    if (interactive && interactive !== currentTarget) return;
    beginLongPress(row);
  }

  function startTouchLongPress(event: React.TouchEvent, row: PackageItem) {
    const target = event.target as HTMLElement;
    const currentTarget = event.currentTarget as HTMLElement;
    const interactive = target.closest("button,a,input,select,textarea");
    if (interactive && interactive !== currentTarget) return;
    const touch = event.touches[0];
    if (touch.clientX < 28 || touch.clientX > window.innerWidth - 28) return;
    touchStart.current = { x: touch.clientX, y: touch.clientY };
    beginLongPress(row);
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

  async function loadData() {
    const [categoryResult, packageResult] = await Promise.all([
      fetch("/api/categories").then((res) => res.json() as Promise<ApiResult<CategoryItem[]>>),
      fetch("/api/packages").then((res) => res.json() as Promise<ApiResult<PackageItem[]>>),
    ]);
    if (categoryResult.data) setCategories(categoryResult.data);
    if (packageResult.data) setRows(packageResult.data);
    if (categoryResult.error && !/chưa đăng nhập/i.test(categoryResult.error.message)) setMessage(categoryResult.error.message);
    if (packageResult.error && !/chưa đăng nhập/i.test(packageResult.error.message)) setMessage(packageResult.error.message);
    setInitialLoading(false);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void loadData(), 0);
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
    const result = await fetch("/api/packages", {
      method: editingId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, id: editingId, ...(editingId && role === "STAFF" ? { studioPassword: editStudioPassword } : {}) }),
    }).then((res) => res.json() as Promise<ApiResult<PackageItem>>);

    if (result.error) return setMessage(result.error.message);

    setForm(emptyForm);
    setEditingId(null);
    setEditStudioPassword("");
    setShowForm(false);
    setMessage(editingId ? "Đã cập nhật gói." : "Đã tạo gói mới.");
    void loadData();
  }

  async function remove(row: PackageItem, mode: "trash" | "hard") {
    const studioPassword = role === "MANAGER" ? window.prompt("Nhập mật khẩu xóa ca 6 số để xóa gói.")?.trim() ?? "" : "";
    if (role === "MANAGER" && !/^\d{6}$/.test(studioPassword)) {
      setMessage("Mật khẩu xóa ca phải gồm 6 số.");
      return;
    }
    setDeleting(true);
    try {
      const result = await fetch("/api/packages", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: row.id, mode, ...(studioPassword ? { studioPassword } : {}) }),
      }).then((res) => res.json() as Promise<ApiResult<{ id: string }>>);

      if (result.error) return setMessage(result.error.message);

      setMessage(mode === "hard" ? "Đã xóa gói." : "Đã chuyển gói vào thùng rác.");
      setDetail(null);
      setDeleteTarget(null);
      setSelectedIds((current) => current.filter((id) => id !== row.id));
      await loadData();
    } finally {
      setDeleting(false);
    }
  }

  async function removeMany(mode: "trash" | "hard") {
    const studioPassword = role === "MANAGER" ? window.prompt("Nhập mật khẩu xóa ca 6 số để xóa gói.")?.trim() ?? "" : "";
    if (role === "MANAGER" && !/^\d{6}$/.test(studioPassword)) {
      setMessage("Mật khẩu xóa ca phải gồm 6 số.");
      return;
    }
    setDeleting(true);
    try {
      const source = bulkDeleteMode === "all" ? filteredRows : filteredRows.filter((row) => selectedIds.includes(row.id));
      for (const row of source) {
        const result = await fetch("/api/packages", {
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
      setMessage(mode === "hard" ? `Đã xóa ${source.length} gói.` : `Đã chuyển ${source.length} gói vào thùng rác.`);
      setSelectedIds([]);
      setBulkDeleteMode(null);
      await loadData();
    } finally {
      setDeleting(false);
    }
  }

  function edit(row: PackageItem) {
    let studioPassword = "";
    if (role === "STAFF") {
      studioPassword = window.prompt("Nhập mật khẩu studio 6 số để sửa gói.")?.trim() ?? "";
      if (!/^\d{6}$/.test(studioPassword)) {
        setMessage("Nhân viên cần nhập đúng mật khẩu studio 6 số để sửa gói.");
        return;
      }
    }
    setDetail(null);
    setEditingId(row.id);
    setEditStudioPassword(studioPassword);
    setShowForm(true);
    setForm({
      name: row.name,
      categoryId: row.categoryId,
      price: String(row.price ?? 0),
      description: row.description ?? "",
      duration: row.duration ?? "",
      suitableFor: row.suitableFor ?? "",
      includes: row.includes ?? "",
      deliverables: row.deliverables ?? "",
      outfitCount: row.outfitCount ?? "",
      peopleCount: row.peopleCount ?? "",
      location: row.location ?? "",
      customerNote: row.customerNote ?? "",
      imageUrl: row.imageUrl ?? "",
      galleryUrls: row.galleryUrls ?? "[]",
    });
  }

  function openGallery(row: PackageItem, index: number) {
    const images = packageImages(row);
    if (!images.length) return;
    setPreview({ images, index, alt: row.name });
  }

  const filteredRows = rows.filter((row) => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return true;
    return [row.name, row.category?.name, row.description, row.duration, row.location, row.suitableFor].some((value) =>
      String(value ?? "").toLowerCase().includes(keyword),
    );
  });
  const progressiveRows = useProgressiveList(filteredRows, 60);
  const allVisibleSelected = filteredRows.length > 0 && filteredRows.every((row) => selectedIds.includes(row.id));

  return (
    <div className="mx-auto max-w-[1100px] space-y-4 sm:space-y-5">
      <StudioBrandPanel
        eyebrow="Menu khách xem"
        title="Gói dịch vụ"
        description="Danh sách gói gọn gàng để khách xem trên điện thoại và chọn nhanh."
        actions={
          role !== "STAFF" ? <Button
            className="w-full sm:w-auto"
            onClick={() => {
              setEditingId(null);
              setEditStudioPassword("");
              setForm(emptyForm);
              setShowForm(true);
            }}
          >
            <Plus size={17} />
            Thêm gói
          </Button> : null
        }
      />
      <section className="hidden">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#EA7188] sm:text-sm">
              Menu gói cho khách xem
            </p>
            <h1 className="mt-1 text-2xl font-black text-[#5B342C] sm:text-3xl">Gói dịch vụ</h1>
            <p className="mt-2 text-sm font-semibold text-[#9B746B]">
              Danh sách gọn, dễ chọn. Bấm vào từng gói để xem đầy đủ chi tiết.
            </p>
          </div>
          <Button
            className="w-full sm:w-auto"
            onClick={() => {
              setEditingId(null);
              setForm(emptyForm);
              setShowForm(true);
            }}
          >
            <Plus size={17} />
            Thêm gói
          </Button>
        </div>
      </section>

      <AlertModal isOpen={!!message} message={message} onClose={() => setMessage("")} />

      <div className="flex items-center gap-2 rounded-2xl border border-[#F4C7C4] bg-white px-4 py-3 shadow-sm">
        <Search size={18} className="shrink-0 text-[#EA7188]" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Tìm gói, danh mục, địa điểm..."
          className="h-8 min-w-0 flex-1 bg-transparent text-sm font-semibold text-[#5B342C] outline-none placeholder:text-[#B98278]"
        />
      </div>

      <div className={showForm ? "grid items-start gap-4 xl:grid-cols-[1fr_420px]" : "grid gap-4"}>
        <div className="space-y-3">
          {filteredRows.length && (role === "ADMIN" || role === "MANAGER") ? (
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
          {progressiveRows.visibleItems.map((row, index) => (
            <PackageListItem
              key={row.id}
              row={row}
              index={index}
              total={filteredRows.length}
              selected={selectedIds.includes(row.id)}
              selectionMode={selectedIds.length > 0}
              onToggleSelect={() => setSelectedIds((current) => current.includes(row.id) ? current.filter((id) => id !== row.id) : [...current, row.id])}
              onOpen={() => {
                if (longPressActivated) {
                  setLongPressActivated(false);
                  return;
                }
                setDetail(row);
              }}
              onLongPressStart={(event) => startLongPress(event, row)}
              onLongTouchStart={(event) => startTouchLongPress(event, row)}
              onLongTouchMove={moveTouchLongPress}
              onLongPressClear={clearLongPress}
              onLongTouchClear={endTouchLongPress}
              focused={focusedItemId === row.id}
            />
          ))}
          <ProgressiveListSentinel refTarget={progressiveRows.sentinelRef} hasMore={progressiveRows.hasMore} />

          {initialLoading && filteredRows.length === 0 ? (
            <PageSpinner label="Đang tải gói dịch vụ…" />
          ) : filteredRows.length === 0 ? (
            <Card className="py-14 text-center">
              <h2 className="text-lg font-bold text-[#5B342C]">
                {query ? "Không tìm thấy gói" : "Chưa có gói dịch vụ"}
              </h2>
              <p className="mt-2 text-sm text-[#9B746B]">Bấm Thêm gói để tạo menu đầu tiên.</p>
            </Card>
          ) : null}
        </div>

        {(() => {
          if (!showForm) return null;
          const formElement = (
            <div ref={formRef} className="scroll-mt-20">
              <button className="studio-mobile-form-backdrop sm:hidden" aria-label="Đóng form" onClick={() => { setEditingId(null); setForm(emptyForm); setShowForm(false); }} />
              <PackageForm
                categories={categories}
                form={form}
                editingId={editingId}
                setForm={setForm}
                onSave={save}
                onClose={() => {
                  setEditingId(null);
                  setForm(emptyForm);
                  setShowForm(false);
                }}
              />
            </div>
          );
          return isMobile ? <Portal>{formElement}</Portal> : formElement;
        })()}
      </div>

      {detail ? (
        <PackageDetailModal
          row={detail}
          onClose={() => setDetail(null)}
          onEdit={() => edit(detail)}
          onRemove={role === "ADMIN" || role === "MANAGER" ? () => setDeleteTarget(detail) : undefined}
          onOpenGallery={openGallery}
        />
      ) : null}

      <DeleteConfirmation
        open={Boolean(deleteTarget)}
        description={`Bạn có chắc chắn muốn xóa gói "${deleteTarget?.name ?? ""}"?`}
        onHardDelete={() => deleteTarget ? void remove(deleteTarget, "hard") : undefined}
        onMoveToTrash={() => deleteTarget ? void remove(deleteTarget, "trash") : undefined}
        onCancel={() => deleting ? undefined : setDeleteTarget(null)}
        loading={deleting}
      />
      <DeleteConfirmation
        open={Boolean(bulkDeleteMode)}
        description={bulkDeleteMode === "all" ? `Bạn có chắc chắn muốn xóa tất cả ${filteredRows.length} gói đang hiển thị?` : `Bạn có chắc chắn muốn xóa ${selectedIds.length} gói đã chọn?`}
        onHardDelete={() => void removeMany("hard")}
        onMoveToTrash={() => void removeMany("trash")}
        onCancel={() => deleting ? undefined : setBulkDeleteMode(null)}
        loading={deleting}
      />

      <ImagePreview
        images={preview?.images}
        index={preview?.index ?? 0}
        alt={preview?.alt}
        onIndexChange={(index) => setPreview((current) => (current ? { ...current, index } : current))}
        onClose={() => setPreview(null)}
      />
    </div>
  );
}

function PackageListItem({
  row,
  index,
  total,
  selected,
  selectionMode,
  onToggleSelect,
  onOpen,
  onLongPressStart,
  onLongTouchStart,
  onLongTouchMove,
  onLongPressClear,
  onLongTouchClear,
  focused,
}: {
  row: PackageItem;
  index: number;
  total: number;
  selected: boolean;
  selectionMode: boolean;
  onToggleSelect: () => void;
  onOpen: () => void;
  onLongPressStart: (event: React.PointerEvent) => void;
  onLongTouchStart: (event: React.TouchEvent) => void;
  onLongTouchMove: (event: React.TouchEvent) => void;
  onLongPressClear: () => void;
  onLongTouchClear: () => void;
  focused?: boolean;
}) {
  return (
    <button
      type="button"
      data-row-id={row.id}
      onClick={onOpen}
      onPointerDown={onLongPressStart}
      onPointerUp={onLongPressClear}
      onPointerCancel={onLongPressClear}
      onPointerLeave={onLongPressClear}
      onTouchStart={onLongTouchStart}
      onTouchMove={onLongTouchMove}
      onTouchEnd={onLongTouchClear}
      onTouchCancel={onLongTouchClear}
      className={`group flex w-full items-center gap-2.5 rounded-[1.2rem] border border-[#F4C7C4] bg-white p-2.5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#EA7188] hover:shadow-md active:scale-[0.99] sm:gap-4 sm:rounded-[1.35rem] sm:p-4 ${focused ? "ring-2 ring-[#EA7188]" : ""}`}
    >
      {selectionMode || selected ? (
        <span
          role="checkbox"
          aria-checked={selected}
          tabIndex={0}
          onClick={(event) => {
            event.stopPropagation();
            onToggleSelect();
          }}
          className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl border text-[12px] font-black transition ${selected ? "border-[#EA7188] bg-[#EA7188] text-white shadow-[0_0_0_4px_rgba(234,113,136,0.18)]" : "border-[#F4C7C4] bg-white text-[#EA7188]"}`}
        >
          {selected ? "✓" : ""}
        </span>
      ) : (
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#FFF0F4] text-[11px] font-black text-[#EA7188] sm:h-9 sm:w-9 sm:rounded-xl sm:text-xs">
          {total - index}
        </span>
      )}
      {false ? <span
        role="checkbox"
        aria-checked={selected}
        tabIndex={0}
        onClick={(event) => {
          event.stopPropagation();
          onToggleSelect();
        }}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          event.stopPropagation();
          onToggleSelect();
        }}
        className="hidden"
      >
        {selected ? "✓" : ""}
      </span> : null}

      <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl border border-[#F7D6D0] bg-[#FFF8F1] sm:h-20 sm:w-20 sm:rounded-2xl">
        {row.imageUrl ? (
          <img src={row.imageUrl} alt={row.name} className="block max-h-full max-w-full object-contain p-1" />
        ) : (
          <ImageIcon size={24} className="text-[#EA7188]" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <h2 className="whitespace-normal break-words text-base font-black leading-6 text-[#5B342C] sm:text-xl">{row.name}</h2>
        <p className="mt-1 text-lg font-black text-[#EA7188] sm:text-2xl">{formatMoney(row.price)}</p>
      </div>

      <span className="hidden rounded-full bg-[#FFF3EC] px-3 py-2 text-xs font-black text-[#9B746B] transition group-hover:bg-[#FFE1E8] group-hover:text-[#5B342C] sm:inline-flex">
        Xem chi tiết
      </span>
      {false ? <span
        role="checkbox"
        aria-checked={selected}
        tabIndex={0}
        onClick={(event) => {
          event.stopPropagation();
          onToggleSelect();
        }}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          event.stopPropagation();
          onToggleSelect();
        }}
        className="grid h-6 w-6 shrink-0 place-items-center rounded-md border border-[#F4C7C4] bg-white text-[10px] font-black text-[#EA7188]"
      >
        {selected ? "✓" : ""}
      </span> : null}
    </button>
  );
}

function PackageDetailModal({
  row,
  onClose,
  onEdit,
  onRemove,
  onOpenGallery,
}: {
  row: PackageItem;
  onClose: () => void;
  onEdit: () => void;
  onRemove?: () => void;
  onOpenGallery: (row: PackageItem, index: number) => void;
}) {
  const thumbs = gallery(row.galleryUrls);
  const includes = listText(row.includes);
  const deliverables = listText(row.deliverables);

  return (
    <DetailModal
      onClose={onClose}
      maxWidth="max-w-6xl"
      scrollKey={row.id}
      header={
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#EA7188]">Chi tiết gói</p>
            <h2 className="whitespace-normal break-words text-lg font-black leading-6 text-[#5B342C] sm:text-2xl">{row.name}</h2>
          </div>
          <div className="relative z-40 flex shrink-0 gap-1.5 sm:gap-2">
            <Button variant="secondary" size="icon" className="h-12 w-12 touch-manipulation rounded-2xl sm:h-11 sm:w-11" aria-label="Sửa gói" onClick={(event) => { event.stopPropagation(); onEdit(); }}>
              <Pencil size={16} />
            </Button>
            {onRemove ? (
              <Button variant="danger" size="icon" className="h-12 w-12 touch-manipulation rounded-2xl sm:h-11 sm:w-11" aria-label="Xóa gói" onClick={(event) => { event.stopPropagation(); onRemove(); }}>
                <Trash2 size={16} />
              </Button>
            ) : null}
          </div>
        </div>
      }
    >
      <div className="-mx-4 -mb-4 sm:-mx-5 sm:-mb-5">
        <div className="grid lg:grid-cols-[minmax(0,1.05fr)_minmax(380px,0.95fr)]">
          <div className="min-w-0 bg-[radial-gradient(circle_at_top_left,#FFE3EA_0,#FFF8F1_32%,#FFFFFF_72%)] p-3 sm:p-6">
            <div className="rounded-[1.5rem] border border-white bg-white/80 p-2 shadow-[0_18px_45px_rgba(91,52,44,0.12)] sm:rounded-[2rem] sm:p-3">
              <button
                type="button"
                className="grid w-full max-w-full place-items-center rounded-[1.25rem] bg-white p-2 sm:rounded-[1.5rem] sm:p-3"
                onClick={() => onOpenGallery(row, 0)}
              >
                {row.imageUrl ? (
                  <img src={row.imageUrl} alt={row.name} className="block h-auto max-h-[46vh] w-auto max-w-full rounded-[1rem] object-contain sm:max-h-[58vh]" />
                ) : (
                  <ImageIcon size={42} className="text-[#EA7188]" />
                )}
              </button>
            </div>

            {thumbs.length ? (
              <div className="mt-4 rounded-[1.75rem] border border-white bg-white/85 p-3 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-xs font-black uppercase tracking-[0.12em] text-[#9B746B]">Bộ ảnh</p>
                  <span className="rounded-full bg-[#FFF0F4] px-3 py-1 text-xs font-black text-[#EA7188]">
                    {thumbs.length + (row.imageUrl ? 1 : 0)} ảnh
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {thumbs.map((url, index) => (
                    <button
                      key={`${url}-${index}`}
                      type="button"
                      onClick={() => onOpenGallery(row, index + (row.imageUrl ? 1 : 0))}
                      className="group grid h-20 place-items-center overflow-hidden rounded-2xl border border-[#F4C7C4] bg-[#FFF8F1] p-1 transition hover:-translate-y-0.5 hover:border-[#EA7188] hover:bg-white hover:shadow-md sm:h-24"
                    >
                      <img src={url} alt="" className="block h-full w-full object-contain transition group-hover:scale-[1.03]" />
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div className="min-w-0 space-y-3 p-3 sm:space-y-4 sm:p-6">
            <div className="rounded-[1.5rem] border border-[#F4C7C4] bg-white p-4 shadow-[0_16px_45px_rgba(91,52,44,0.08)] sm:rounded-[2rem] sm:p-5">
              <div className="flex flex-wrap items-center gap-2">
                <p className="w-fit rounded-full bg-[#FFF0F4] px-3 py-1 text-xs font-black uppercase text-[#EA7188]">
                  {row.category?.name ?? "Chưa có danh mục"}
                </p>
                <p className="w-fit rounded-full bg-[#FFF8F1] px-3 py-1 text-xs font-black text-[#9B746B]">
                  Menu khách xem
                </p>
              </div>
              <h3 className="mt-3 text-2xl font-black leading-tight text-[#5B342C] sm:mt-4 sm:text-4xl">{row.name}</h3>
              <div className="mt-4 rounded-[1.5rem] bg-[#EA7188] p-4 text-white shadow-[0_16px_36px_rgba(234,113,136,0.28)]">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-white/75">Giá gói</p>
                <p className="mt-1 break-words text-2xl font-black sm:text-4xl">{formatMoney(row.price)}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <MenuMeta icon={Clock} label={row.duration || "Chưa nhập"} />
              <MenuMeta icon={Users} label={row.peopleCount || "Linh hoạt"} />
              <MenuMeta icon={Shirt} label={row.outfitCount || "Tùy chọn"} />
              <MenuMeta icon={MapPin} label={row.location || "Tại studio"} />
            </div>

            {row.description ? (
              <section className="rounded-[1.5rem] border border-[#F4C7C4] bg-white p-4 shadow-sm">
                <p className="mb-2 text-xs font-black uppercase tracking-[0.12em] text-[#EA7188]">Mô tả</p>
                <p className="text-sm font-semibold leading-6 text-[#8C655E]">{row.description}</p>
              </section>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              {includes.length ? <MenuBlock icon={CheckCircle2} title="Bao gồm" items={includes} /> : null}
              {deliverables.length ? <MenuBlock icon={Gift} title="Khách nhận được" items={deliverables} /> : null}
            </div>

            {row.suitableFor ? (
              <div className="rounded-[1.5rem] border border-[#F4C7C4] bg-[#FFF8F1] p-4 text-sm font-semibold leading-6 text-[#5B342C]">
                <span className="font-black text-[#EA7188]">Phù hợp: </span>
                {row.suitableFor}
              </div>
            ) : null}

            {row.customerNote ? (
              <div className="rounded-[1.5rem] border border-[#F4C7C4] bg-white p-4 shadow-sm">
                <p className="mb-2 text-xs font-black uppercase tracking-[0.12em] text-[#EA7188]">Lưu ý</p>
                <p className="text-sm font-semibold leading-6 text-[#9B746B]">{row.customerNote}</p>
              </div>
            ) : null}

            {/* Safe area spacer for mobile */}
            <div className="h-20 sm:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom)" }} />
          </div>
        </div>
      </div>
    </DetailModal>
  );
}

function PackageForm({
  categories,
  form,
  editingId,
  setForm,
  onSave,
  onClose,
}: {
  categories: CategoryItem[];
  form: typeof emptyForm;
  editingId: string | null;
  setForm: Dispatch<SetStateAction<typeof emptyForm>>;
  onSave: () => void;
  onClose: () => void;
}) {
  return (
    <Card className="studio-mobile-form-sheet h-fit xl:sticky xl:top-24">
      <div className="mb-3 flex justify-end">
        <Button variant="secondary" size="icon" aria-label="Đóng form" onClick={onClose}>
          <X size={16} />
        </Button>
      </div>
      <div className="mb-5 flex items-center gap-2">
        <Plus className="text-[#EA7188]" size={20} />
        <CardTitle>{editingId ? "Sửa gói" : "Thêm gói"}</CardTitle>
      </div>
      <div className="space-y-4">
        <MediaGalleryPicker
          mainUrl={form.imageUrl}
          galleryUrls={form.galleryUrls}
          onMainChange={(value) => setForm((current) => ({ ...current, imageUrl: value }))}
          onGalleryChange={(value) => setForm((current) => ({ ...current, galleryUrls: value }))}
        />
        <label>
          <span className="mb-2 block text-sm font-bold text-[#5B342C]">Danh mục</span>
          <select
            className="h-12 w-full rounded-2xl border border-[#F4C7C4] bg-white px-4 text-sm text-[#5B342C] outline-none"
            value={form.categoryId}
            onChange={(event) => setForm((current) => ({ ...current, categoryId: event.target.value }))}
          >
            <option value="">Chọn danh mục</option>
            {categories.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="mb-2 block text-sm font-bold text-[#5B342C]">Tên gói</span>
          <Input
            value={form.name}
            placeholder="Concept Búp Bê..."
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label>
            <span className="mb-2 block text-sm font-bold text-[#5B342C]">Giá</span>
            <Input
              type="number"
              value={form.price}
              onChange={(event) => setForm((current) => ({ ...current, price: event.target.value }))}
            />
          </label>
          <label>
            <span className="mb-2 block text-sm font-bold text-[#5B342C]">Thời lượng</span>
            <Input
              value={form.duration}
              placeholder="2 giờ"
              onChange={(event) => setForm((current) => ({ ...current, duration: event.target.value }))}
            />
          </label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            value={form.peopleCount}
            placeholder="Số người"
            onChange={(event) => setForm((current) => ({ ...current, peopleCount: event.target.value }))}
          />
          <Input
            value={form.outfitCount}
            placeholder="Outfit"
            onChange={(event) => setForm((current) => ({ ...current, outfitCount: event.target.value }))}
          />
        </div>
        <Input
          value={form.location}
          placeholder="Địa điểm"
          onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))}
        />
        <Input
          value={form.suitableFor}
          placeholder="Phù hợp với"
          onChange={(event) => setForm((current) => ({ ...current, suitableFor: event.target.value }))}
        />
        <Textarea
          value={form.description}
          placeholder="Mô tả ngắn"
          onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
        />
        <Textarea
          value={form.includes}
          placeholder={"Bao gồm\nMakeup cơ bản\nChụp 1 concept"}
          onChange={(event) => setForm((current) => ({ ...current, includes: event.target.value }))}
        />
        <Textarea
          value={form.deliverables}
          placeholder={"Khách nhận được\n10 ảnh chỉnh màu\nFile online"}
          onChange={(event) => setForm((current) => ({ ...current, deliverables: event.target.value }))}
        />
         <Textarea
          value={form.customerNote}
          placeholder="Lưu ý cho khách"
          onChange={(event) => setForm((current) => ({ ...current, customerNote: event.target.value }))}
        />
      </div>
      <div className="mt-5">
        <Button className="w-full min-h-11" onClick={onSave}>
          {editingId ? "Cập nhật" : "Tạo gói"}
        </Button>
      </div>
      {/* Thêm khoảng trống ở cuối để không bị che bởi menu/nav bar điện thoại */}
      <div className="h-20 sm:hidden" />
    </Card>
  );
}

function MenuMeta({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-[1.25rem] border border-[#F4C7C4] bg-white px-3 py-3 text-xs font-black text-[#5B342C] shadow-sm">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[#FFF0F4] text-[#EA7188]">
        <Icon size={15} />
      </span>
      <span className="whitespace-normal break-words leading-5">{label}</span>
    </div>
  );
}

function MenuBlock({ icon: Icon, title, items }: { icon: LucideIcon; title: string; items: string[] }) {
  return (
    <div className="rounded-[1.5rem] border border-[#F4C7C4] bg-white p-4 shadow-sm">
      <p className="mb-3 flex items-center gap-2 text-sm font-black text-[#5B342C]">
        <span className="grid h-8 w-8 place-items-center rounded-xl bg-[#FFF0F4] text-[#EA7188]">
          <Icon size={16} />
        </span>
        {title}
      </p>
      <div className="space-y-1">
        {items.map((item, index) => (
          <p key={`${item}-${index}`} className="flex gap-2 text-sm font-semibold leading-5 text-[#8C655E]">
            <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-600" />
            {item}
          </p>
        ))}
      </div>
    </div>
  );
}
