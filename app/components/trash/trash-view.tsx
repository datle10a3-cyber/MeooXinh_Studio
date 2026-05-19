"use client";

import { useEffect, useState } from "react";
import { RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { DetailModal } from "@/app/components/ui/detail-modal";
import { Card, CardTitle } from "@/app/components/ui/card";
import { DeleteConfirmation } from "@/app/components/ui/delete-confirmation";
import { StudioBrandPanel } from "@/app/components/brand/studio-brand";
import { PageSpinner } from "@/app/components/ui/skeleton";
import { RESOURCE_CONFIG, type ResourceKey } from "@/app/lib/studio-config";
import { formatDate, formatMoney } from "@/app/utils/format";
import { useUiStore } from "@/app/store/ui-store";

const resources = Object.keys(RESOURCE_CONFIG) as ResourceKey[];
const specialResources = [
  { resource: "categories", endpoint: "/api/categories", label: "Danh mục", primaryField: "name" },
  { resource: "packages", endpoint: "/api/packages", label: "Gói", primaryField: "name" },
] as const;

type SpecialResourceKey = (typeof specialResources)[number]["resource"];
type TrashResourceKey = ResourceKey | SpecialResourceKey;
type TrashItem = Record<string, unknown> & { resource: TrashResourceKey };
type TrashGroup = { key: string; title?: string; items: TrashItem[] };

function itemKey(item: TrashItem) {
  return `${item.resource}:${String(item.id)}`;
}

function bookingGroupName(note?: unknown) {
  const match = String(note ?? "").match(/Loại booking:\s*Booking nhóm(?:\s*-\s*([^\n.]+))?/i);
  return match ? (match[1]?.trim() || "Booking nhóm") : null;
}

function bookingGroupKey(item: TrashItem) {
  if (item.resource !== "bookings") return "";
  const groupName = bookingGroupName(item.note);
  if (!groupName) return "";
  return `booking-group:${groupName.trim().toLowerCase()}`;
}

function getTrashConfig(item: TrashItem) {
  return specialResources.find((entry) => entry.resource === item.resource) ?? RESOURCE_CONFIG[item.resource as ResourceKey];
}

function getFieldLabel(item: TrashItem, key: string) {
  const config = getTrashConfig(item);
  const field = "fields" in config ? config.fields.find((entry) => entry.key === key) : null;
  return field?.label ?? key;
}

function formatTrashValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "Chưa có";
  if (typeof value === "boolean") return value ? "Có" : "Không";
  if (typeof value === "number") return Math.abs(value) >= 1000 ? formatMoney(value) : String(value);
  if (value instanceof Date) return formatDate(value);
  if (typeof value === "string") {
    const dateValue = new Date(value);
    if (/^\d{4}-\d{2}-\d{2}/.test(value) && Number.isFinite(dateValue.getTime())) return formatDate(dateValue);
    return value;
  }
  if (Array.isArray(value)) return value.length ? value.join(", ") : "Chưa có";
  return JSON.stringify(value);
}

function detailRows(item: TrashItem) {
  const hidden = new Set(["id", "studioId", "resource", "deletedAt", "deletedBy", "updatedAt"]);
  return Object.entries(item).filter(([key, value]) => !hidden.has(key) && value !== null && value !== undefined && value !== "");
}

export function TrashView() {
  const session = useUiStore((state) => state.session);
  const [items, setItems] = useState<TrashItem[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [deleteMode, setDeleteMode] = useState<"one" | "selected" | "all" | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TrashItem | null>(null);
  const [detailItem, setDetailItem] = useState<TrashItem | null>(null);
  const [longPressTimer, setLongPressTimer] = useState<number | null>(null);
  const [longPressActivated, setLongPressActivated] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  async function loadTrash() {
    const results = await Promise.all(
      resources.map(async (resource) => {
        const result = await fetch(`/api/resources/${resource}?trash=1`).then((res) => res.json()).catch(() => null);
        return (result?.data ?? []).map((item: Record<string, unknown>) => ({ ...item, resource }));
      }),
    );
    const specialResults = await Promise.all(
      specialResources.map(async (entry) => {
        const result = await fetch(`${entry.endpoint}?trash=1`).then((res) => res.json()).catch(() => null);
        return (result?.data ?? []).map((item: Record<string, unknown>) => ({ ...item, resource: entry.resource }));
      }),
    );
    setItems(
      [...results, ...specialResults]
        .flat()
        .sort((a, b) => new Date(String(b.deletedAt ?? b.createdAt ?? 0)).getTime() - new Date(String(a.deletedAt ?? a.createdAt ?? 0)).getTime()),
    );
    setInitialLoading(false);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void loadTrash(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function restore(item: TrashItem) {
    if (item.resource === "categories" || item.resource === "packages") return;
    await fetch(`/api/resources/${item.resource}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id }),
    });
    setSelectedKeys((current) => current.filter((key) => key !== itemKey(item)));
    setDetailItem(null);
    void loadTrash();
  }

  async function restoreGroup(group: TrashGroup) {
    for (const item of group.items) await restore(item);
    setSelectedKeys((current) => current.filter((key) => key !== group.key));
    void loadTrash();
  }

  async function hardDelete(item: TrashItem, studioPassword?: string) {
    const endpoint = item.resource === "categories" ? "/api/categories" : item.resource === "packages" ? "/api/packages" : `/api/resources/${item.resource}`;
    await fetch(endpoint, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id, mode: "hard", ...(studioPassword ? { studioPassword } : {}) }),
    });
  }

  async function confirmDelete() {
    const studioPassword = session?.user.role === "MANAGER" ? window.prompt("Nhập mật khẩu xóa ca 6 số để xóa vĩnh viễn.")?.trim() ?? "" : "";
    if (session?.user.role === "MANAGER" && !/^\d{6}$/.test(studioPassword)) return;
    const expandedSelected = displayGroups.flatMap((group) => {
      if (selectedKeys.includes(group.key)) return group.items;
      return group.items.filter((item) => selectedKeys.includes(itemKey(item)));
    });
    const source =
      deleteMode === "one" && deleteTarget
        ? [deleteTarget]
        : deleteMode === "all"
          ? items
          : expandedSelected;

    for (const item of source) await hardDelete(item, studioPassword);
    setDeleteMode(null);
    setDeleteTarget(null);
    setDetailItem(null);
    setSelectedKeys([]);
    void loadTrash();
  }

  const displayGroups = (() => {
    const singles: TrashGroup[] = [];
    const grouped = new Map<string, { title: string; items: TrashItem[] }>();
    for (const item of items) {
      const groupTitle = bookingGroupName(item.note);
      const groupKey = bookingGroupKey(item);
      if (!groupTitle || !groupKey) {
        singles.push({ key: itemKey(item), items: [item] });
        continue;
      }
      const current = grouped.get(groupKey) ?? { title: groupTitle, items: [] };
      current.items.push(item);
      grouped.set(groupKey, current);
    }
    return [
      ...singles,
      ...Array.from(grouped.entries()).map(([key, value]) => ({ key, title: value.title, items: value.items })),
    ].sort((a, b) => new Date(String(b.items[0]?.deletedAt ?? b.items[0]?.createdAt ?? 0)).getTime() - new Date(String(a.items[0]?.deletedAt ?? a.items[0]?.createdAt ?? 0)).getTime());
  })();

  const allSelected = displayGroups.length > 0 && displayGroups.every((group) => selectedKeys.includes(group.key));
  const deleteCount = (() => {
    if (deleteMode === "one") return 1;
    if (deleteMode === "all") return items.length;
    return displayGroups.reduce((total, group) => total + (selectedKeys.includes(group.key) ? group.items.length : 0), 0);
  })();

  function toggleSelect(key: string) {
    setSelectedKeys((current) => current.includes(key) ? current.filter((itemKeyValue) => itemKeyValue !== key) : [...current, key]);
  }

  function clearLongPress() {
    if (longPressTimer !== null) {
      window.clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  }

  function startLongPress(event: React.PointerEvent, key: string) {
    const target = event.target as HTMLElement;
    const currentTarget = event.currentTarget as HTMLElement;
    if (event.pointerType === "touch" && (event.clientX < 28 || event.clientX > window.innerWidth - 28)) return;
    if (target !== currentTarget && target.closest("button,a,input,select,textarea")) return;
    clearLongPress();
    const timer = window.setTimeout(() => {
      toggleSelect(key);
      setLongPressActivated(true);
      setLongPressTimer(null);
    }, 520);
    setLongPressTimer(timer);
  }

  return (
    <div className="space-y-6">
      <StudioBrandPanel
        eyebrow="Quản lý dữ liệu"
        title="Thùng rác"
        description="Bấm vào từng mục để xem chi tiết, khôi phục hoặc xóa vĩnh viễn dữ liệu đã chuyển vào thùng rác."
      />

      {selectedKeys.length > 0 && items.length > 0 ? (
        <div className="flex flex-col gap-2 rounded-2xl border border-[#F4C7C4] bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <label className="flex items-center gap-2 text-sm font-black text-[#5B342C]">
            <input
              type="checkbox"
              className="h-4 w-4 accent-[#EA7188]"
              checked={allSelected}
              onChange={(event) => setSelectedKeys(event.target.checked ? displayGroups.map((group) => group.key) : [])}
            />
            Chọn tất cả ({displayGroups.length})
          </label>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <Button variant="secondary" size="sm" disabled={!selectedKeys.length} onClick={() => setDeleteMode("selected")}>
              Xóa đã chọn ({selectedKeys.length})
            </Button>
            <Button variant="danger" size="sm" onClick={() => setDeleteMode("all")}>
              Xóa tất cả
            </Button>
          </div>
        </div>
      ) : null}

      <div className="grid gap-3">
        {displayGroups.map((group, index) => {
          if (group.title) {
            const selected = selectedKeys.includes(group.key);
            const packageNames = [...new Set(group.items.map((item) => item.packageName).filter(Boolean).map(String))];
            return (
              <Card
                key={group.key}
                onPointerDown={(event) => startLongPress(event, group.key)}
                onPointerUp={clearLongPress}
                onPointerCancel={clearLongPress}
                onPointerLeave={clearLongPress}
                className={`flex flex-col gap-4 transition hover:-translate-y-0.5 hover:shadow-md sm:flex-row sm:items-center sm:justify-between ${selected ? "ring-4 ring-[#EA7188]/15" : ""}`}
              >
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-start gap-3 text-left"
                  onClick={() => {
                    if (longPressActivated) {
                      setLongPressActivated(false);
                      return;
                    }
                    toggleSelect(group.key);
                  }}
                >
                  {selectedKeys.length > 0 || selected ? (
                    <span
                      role="checkbox"
                      aria-checked={selected}
                      tabIndex={0}
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleSelect(group.key);
                      }}
                      className={[
                        "grid h-10 w-10 shrink-0 place-items-center rounded-2xl border text-sm font-black transition",
                        selected ? "scale-105 border-[#EA7188] bg-[#EA7188] text-white shadow-[0_0_0_4px_rgba(234,113,136,0.18)]" : "border-[#F4C7C4] bg-white text-[#EA7188]",
                      ].join(" ")}
                    >
                      {selected ? "✓" : ""}
                    </span>
                  ) : (
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-[#F4C7C4] bg-[#FFF3EC] text-sm font-black text-[#5B342C]">
                      {displayGroups.length - index}
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-black uppercase tracking-wide text-[#EA7188]">Booking nhóm</p>
                    <CardTitle className="mt-1 whitespace-normal break-words leading-6">{group.title}</CardTitle>
                    <p className="mt-1 text-sm font-semibold text-[#9B746B]">
                      {group.items.length} khách · {packageNames.length <= 1 ? (packageNames[0] ?? "Chưa có gói") : `${packageNames.length} gói khác nhau`}
                    </p>
                  </div>
                </button>
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                  <Button variant="secondary" onClick={() => void restoreGroup(group)}>
                    <RotateCcw size={16} />
                    Khôi phục nhóm
                  </Button>
                  <Button variant="danger" onClick={() => { setSelectedKeys([group.key]); setDeleteMode("selected"); }}>
                    <Trash2 size={16} />
                    Xóa hẳn
                  </Button>
                </div>
              </Card>
            );
          }
          const item = group.items[0];
          const config = getTrashConfig(item);
          const title = String(item[config.primaryField] ?? item.id);
          const key = group.key;
          return (
            <Card
              key={key}
              onPointerDown={(event) => startLongPress(event, key)}
              onPointerUp={clearLongPress}
              onPointerCancel={clearLongPress}
              onPointerLeave={clearLongPress}
              className="flex flex-col gap-4 transition hover:-translate-y-0.5 hover:shadow-md sm:flex-row sm:items-center sm:justify-between"
            >
              <button
                type="button"
                className="flex min-w-0 flex-1 items-start gap-3 text-left"
                onClick={() => {
                  if (longPressActivated) {
                    setLongPressActivated(false);
                    return;
                  }
                  setDetailItem(item);
                }}
              >
                {selectedKeys.length > 0 || selectedKeys.includes(key) ? (
                  <span
                    role="checkbox"
                    aria-checked={selectedKeys.includes(key)}
                    tabIndex={0}
                    onClick={(event) => {
                      event.stopPropagation();
                      toggleSelect(key);
                    }}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter" && event.key !== " ") return;
                      event.preventDefault();
                      event.stopPropagation();
                      toggleSelect(key);
                    }}
                    className={[
                      "grid h-10 w-10 shrink-0 place-items-center rounded-2xl border text-sm font-black transition",
                      selectedKeys.includes(key) ? "border-[#EA7188] bg-[#EA7188] text-white shadow-[0_0_0_4px_rgba(234,113,136,0.18)] scale-105" : "border-[#F4C7C4] bg-white text-[#EA7188]",
                    ].join(" ")}
                  >
                    {selectedKeys.includes(key) ? "✓" : ""}
                  </span>
                ) : (
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-[#F4C7C4] bg-[#FFF3EC] text-sm font-black text-[#5B342C]">
                    {displayGroups.length - index}
                  </span>
                )}
                <div className="min-w-0">
                  <CardTitle className="whitespace-normal break-words leading-6">{title}</CardTitle>
                  <p className="mt-1 text-sm text-[#9B746B]">{config.label}</p>
                </div>
              </button>
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                <Button variant="secondary" disabled={item.resource === "categories" || item.resource === "packages"} onClick={() => void restore(item)}>
                  <RotateCcw size={16} />
                  Khôi phục
                </Button>
                <Button variant="danger" onClick={() => { setDeleteTarget(item); setDeleteMode("one"); }}>
                  <Trash2 size={16} />
                  Xóa hẳn
                </Button>
                <button
                  type="button"
                  onClick={() => toggleSelect(key)}
                  className="hidden"
                  aria-label="Chọn mục trong thùng rác"
                >
                  {selectedKeys.includes(key) ? "✓" : ""}
                </button>
              </div>
            </Card>
          );
        })}
        {initialLoading && items.length === 0 ? (
          <PageSpinner label="Đang tải thùng rác…" />
        ) : items.length === 0 ? (
          <Card className="py-10 text-center text-[#9B746B]">Thùng rác đang trống.</Card>
        ) : null}
      </div>

      {detailItem ? (
        <TrashDetailModal
          item={detailItem}
          onClose={() => setDetailItem(null)}
          onRestore={() => void restore(detailItem)}
          onDelete={() => { setDeleteTarget(detailItem); setDeleteMode("one"); }}
        />
      ) : null}

      <DeleteConfirmation
        open={Boolean(deleteMode)}
        title="Xóa vĩnh viễn"
        description={`Bạn có chắc chắn muốn xóa vĩnh viễn ${deleteCount} mục? Thao tác này không thể khôi phục.`}
        hardLabel="Xóa vĩnh viễn"
        trashLabel="Giữ trong thùng rác"
        onHardDelete={() => void confirmDelete()}
        onMoveToTrash={() => { setDeleteMode(null); setDeleteTarget(null); }}
        onCancel={() => { setDeleteMode(null); setDeleteTarget(null); }}
      />
    </div>
  );
}

function TrashDetailModal({ item, onClose, onRestore, onDelete }: { item: TrashItem; onClose: () => void; onRestore: () => void; onDelete: () => void }) {
  const config = getTrashConfig(item);
  const title = String(item[config.primaryField] ?? item.id);
  const rows = detailRows(item);
  const canRestore = item.resource !== "categories" && item.resource !== "packages";

  return (
    <DetailModal
      onClose={onClose}
      maxWidth="max-w-3xl"
      header={
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#EA7188]">Chi tiết trong thùng rác</p>
          <h2 className="mt-1 whitespace-normal break-words text-xl font-black leading-7 text-[#5B342C] sm:text-2xl">{title}</h2>
          <p className="mt-1 text-sm font-semibold text-[#9B746B]">{config.label}</p>
        </div>
      }
      footer={
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose}>Đóng</Button>
          <Button variant="secondary" disabled={!canRestore} onClick={onRestore}>
            <RotateCcw size={16} />
            Khôi phục
          </Button>
          <Button variant="danger" onClick={onDelete}>
            <Trash2 size={16} />
            Xóa hẳn
          </Button>
        </div>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {rows.map(([key, value]) => (
          <div key={key} className="rounded-2xl bg-[#FFF8F1] p-4 ring-1 ring-[#F4C7C4]">
            <p className="text-xs font-black uppercase tracking-[0.12em] text-[#A84E61]">{getFieldLabel(item, key)}</p>
            <p className="mt-2 whitespace-pre-wrap break-words text-sm font-bold leading-6 text-[#5B342C]">{formatTrashValue(value)}</p>
          </div>
        ))}
      </div>
    </DetailModal>
  );
}
