"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CalendarClock, CheckCircle2, Loader2, Printer, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { DetailModal } from "@/app/components/ui/detail-modal";
import { Card, CardTitle } from "@/app/components/ui/card";
import { DeleteConfirmation } from "@/app/components/ui/delete-confirmation";
import { StudioBrandPanel } from "@/app/components/brand/studio-brand";
import { MediaPicker } from "@/app/components/media/media-picker";
import { DateTimeInput, Input, Textarea } from "@/app/components/ui/input";
import { ProgressiveListSentinel, useProgressiveList } from "@/app/components/ui/progressive-list";
import type { ApiResult, BookingItem, PackageItem } from "@/app/components/catalog/types";
import { formatDate, formatMoney } from "@/app/utils/format";
import { viOption } from "@/app/lib/vietnamese-labels";
import { useUiStore } from "@/app/store/ui-store";
import { AlertModal } from "@/app/components/ui/alert-modal";
import { Portal } from "@/app/components/ui/portal";

type CustomerItem = { id: string; name: string; phone?: string | null; avatarUrl?: string | null };
type CustomerPage = { items: CustomerItem[] };
type SearchCustomerItem = {
  id: string;
  type: string;
  title: string;
  subtitle?: string | null;
  targetResource?: string;
};

const PAYMENT_BANK_BIN = "970415";
const PAYMENT_ACCOUNT_NUMBER = "100882473179";
const PAYMENT_ACCOUNT_NAME = "LE THI THU THAO";
const STUDIO_PHONE = "0334043870";
const STUDIO_ADDRESS = "142 Nguyễn Văn Cừ, Phường Diên Hồng, Tỉnh Gia Lai";

function receiptAmountNumber(value: unknown) {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? Math.max(0, Math.round(amount)) : 0;
}

function buildPaymentQrUrl(amount: unknown, invoiceCode: string) {
  const baseUrl = process.env.NEXT_PUBLIC_PAYMENT_QR_URL?.trim() || `https://img.vietqr.io/image/${PAYMENT_BANK_BIN}-${PAYMENT_ACCOUNT_NUMBER}-qr_only.png`;
  if (!/^https?:\/\//i.test(baseUrl)) return baseUrl;
  const url = new URL(baseUrl);
  url.searchParams.set("amount", String(receiptAmountNumber(amount)));
  url.searchParams.set("addInfo", `Thanh toan ${invoiceCode}`);
  url.searchParams.set("accountName", PAYMENT_ACCOUNT_NAME);
  return url.toString();
}

const emptyForm = {
  bookingMode: "PERSONAL",
  groupLabel: "",
  groupCustomers: "",
  customerId: "",
  customerName: "",
  imageUrl: "",
  packageId: "",
  price: "0",
  categoryName: "",
  packageName: "",
  discountType: "NONE",
  discountValue: "",
  startTime: "",
  endTime: "",
  note: "",
  status: "PENDING",
};

function moneyNumber(value: unknown) {
  return Number(String(value ?? 0).replace(/[^\d.-]/g, "")) || 0;
}

function discountedTotal(price: unknown, discountType: string, discountValue: unknown) {
  const base = moneyNumber(price);
  const value = Math.max(0, moneyNumber(discountValue));
  const discount = discountType === "PERCENT"
    ? Math.min(base, Math.round(base * Math.min(value, 100) / 100))
    : discountType === "AMOUNT"
      ? Math.min(base, value)
      : 0;
  return { discount, total: Math.max(0, base - discount) };
}

function parseGroupCustomers(value: string) {
  return value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function bookingGroupName(note?: string | null) {
  const match = String(note ?? "").match(/Loại booking:\s*Booking nhóm(?:\s*-\s*([^\n.]+))?/i);
  return match ? (match[1]?.trim() || "Booking nhóm") : null;
}

function bookingGroupKey(row: BookingItem) {
  const groupName = bookingGroupName(row.note);
  if (!groupName) return "";
  return groupName.trim().toLowerCase();
}

function renameBookingGroupNote(note: string | null | undefined, nextName: string) {
  const source = String(note ?? "").trim();
  const nextLabel = `Loại booking: Booking nhóm - ${nextName}.`;
  if (/Loại booking:\s*Booking nhóm(?:\s*-\s*[^\n.]+)?\./i.test(source)) {
    return source.replace(/Loại booking:\s*Booking nhóm(?:\s*-\s*[^\n.]+)?\./i, nextLabel);
  }
  return [source, nextLabel].filter(Boolean).join("\n");
}

function bookingDateBadge(value: unknown) {
  const date = new Date(String(value ?? ""));
  if (Number.isNaN(date.getTime())) return "Chưa có ngày";
  const dateStr = new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
  const timeStr = new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
  return `${dateStr} | ${timeStr}`;
}

function customerListFromData(data?: CustomerItem[] | CustomerPage) {
  if (Array.isArray(data)) return data;
  return data?.items ?? [];
}

function CustomerSearchPicker({
  customers,
  selectedId,
  selectedName,
  onPick,
  onClear,
}: {
  customers: CustomerItem[];
  selectedId: string;
  selectedName: string;
  onPick: (customer: CustomerItem) => void;
  onClear: () => void;
}) {
  const pickerRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<CustomerItem[]>([]);
  const [loading, setLoading] = useState(false);
  const trimmedQuery = query.trim();
  const localResults = customers
    .filter((item) => {
      const keyword = trimmedQuery.toLowerCase();
      if (!keyword) return true;
      return `${item.name} ${item.phone ?? ""}`.toLowerCase().includes(keyword);
    })
    .slice(0, 20);
  const shownResults = trimmedQuery.length >= 2 ? results : localResults;

  useEffect(() => {
    if (trimmedQuery.length < 2) {
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      const params = new URLSearchParams({ q: trimmedQuery, cursorMode: "1", take: "20" });
      const result = await fetch(`/api/search?${params.toString()}`, { signal: controller.signal })
        .then((res) => res.json())
        .catch(() => null);
      const items = (result?.data?.items ?? []) as SearchCustomerItem[];
      setResults(
        items
          .filter((item) => item.type === "customers" || item.targetResource === "customers")
          .map((item) => ({
            id: item.id,
            name: item.title,
            phone: item.subtitle && /[\d@]/.test(item.subtitle) ? item.subtitle : null,
          })),
      );
      setLoading(false);
    }, 220);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [trimmedQuery]);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: PointerEvent) {
      if (!pickerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  return (
    <div ref={pickerRef} className="relative rounded-2xl border border-[#F4C7C4] bg-white p-3">
      <div className="flex items-center gap-2">
        <Search size={18} className="shrink-0 text-[#EA7188]" />
        <Input
          value={query}
          placeholder={selectedName ? "Tìm khách khác theo tên hoặc số điện thoại..." : "Tìm khách CRM theo tên hoặc số điện thoại..."}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
        />
      </div>

      {selectedId || selectedName ? (
        <div className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-[#FFF3EC] px-3 py-2">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase text-[#C87888]">Khách đang chọn</p>
            <p className="truncate text-sm font-black text-[#5B342C]">{selectedName || "Khách CRM"}</p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={onClear}>
            Nhập khách lạ
          </Button>
        </div>
      ) : null}

      {open ? (
        <div className="absolute left-3 right-3 top-[calc(100%-0.5rem)] z-30 max-h-72 overflow-y-auto rounded-2xl border border-[#F4C7C4] bg-white p-2 shadow-[0_18px_50px_rgba(91,52,44,0.18)]">
          {loading ? <p className="px-3 py-4 text-sm font-bold text-[#9B746B]">Đang tìm khách...</p> : null}
          {!loading && shownResults.length
            ? shownResults.map((customer) => (
                <button
                  key={customer.id}
                  type="button"
                  className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left transition hover:bg-[#FFF3EC]"
                  onClick={() => {
                    onPick(customer);
                    setQuery("");
                    setOpen(false);
                  }}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-black text-[#5B342C]">{customer.name}</span>
                    <span className="block truncate text-xs font-bold text-[#9B746B]">{customer.phone || "Khách CRM"}</span>
                  </span>
                  {selectedId === customer.id ? <CheckCircle2 size={18} className="shrink-0 text-[#009B72]" /> : null}
                </button>
              ))
            : null}
          {!loading && !shownResults.length ? (
            <p className="px-3 py-4 text-sm font-bold text-[#9B746B]">Không tìm thấy khách phù hợp.</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function BookingPage({ completedOnly = false }: { completedOnly?: boolean }) {
  const [loadingData, setLoadingData] = useState(true);
  const [customers, setCustomers] = useState<CustomerItem[]>([]);
  const [packages, setPackages] = useState<PackageItem[]>([]);
  const [rows, setRows] = useState<BookingItem[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [detail, setDetail] = useState<BookingItem | null>(null);
  const [message, setMessage] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [query, setQuery] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<BookingItem | null>(null);
  const [cancelTarget, setCancelTarget] = useState<BookingItem | null>(null);
  const [paymentTarget, setPaymentTarget] = useState<BookingItem | null>(null);
  const [groupPaymentTarget, setGroupPaymentTarget] = useState<{ key: string; title?: string; rows: BookingItem[] } | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkDeleteMode, setBulkDeleteMode] = useState<"selected" | "all" | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [processingStatus, setProcessingStatus] = useState(false);
  const [longPressActivated, setLongPressActivated] = useState(false);
  const [editStudioPassword, setEditStudioPassword] = useState("");
  const [groupPackageIds, setGroupPackageIds] = useState<string[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);
  const [selectedGroupKeys, setSelectedGroupKeys] = useState<string[]>([]);
  const [groupSelectionMode, setGroupSelectionMode] = useState(false);
  const role = useUiStore((state) => state.session?.user.role ?? null);
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);
  const focusedItemId = useUiStore((state) => state.focusedItemId);
  const setFocusedItemId = useUiStore((state) => state.setFocusedItemId);
  const longPressTimer = useRef<number | null>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  function clearLongPress() {
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  function beginLongPress(row: BookingItem) {
    clearLongPress();
    longPressTimer.current = window.setTimeout(() => {
      setSelectedIds((current) => current.includes(row.id) ? current : [...current, row.id]);
      setLongPressActivated(true);
      longPressTimer.current = null;
    }, 430);
  }

  function toggleGroupSelection(groupKey: string) {
    const group = displayGroups.find((g) => g.key === groupKey);
    if (!group) return;

    const isSelecting = !selectedGroupKeys.includes(groupKey);
    const childIds = group.rows.map((row) => row.id);

    setSelectedGroupKeys((current) => {
      const next = isSelecting ? [...current, groupKey] : current.filter((key) => key !== groupKey);
      setGroupSelectionMode(next.length > 0);
      return next;
    });

    setSelectedIds((current) => {
      if (isSelecting) {
        const next = [...current];
        for (const id of childIds) {
          if (!next.includes(id)) next.push(id);
        }
        return next;
      } else {
        return current.filter((id) => !childIds.includes(id));
      }
    });
  }

  function beginGroupLongPress(groupKey: string) {
    clearLongPress();
    longPressTimer.current = window.setTimeout(() => {
      const group = displayGroups.find((g) => g.key === groupKey);
      if (group) {
        const childIds = group.rows.map((row) => row.id);
        setSelectedGroupKeys((current) => current.includes(groupKey) ? current : [...current, groupKey]);
        setSelectedIds((current) => {
          const next = [...current];
          for (const id of childIds) {
            if (!next.includes(id)) next.push(id);
          }
          return next;
        });
        setGroupSelectionMode(true);
        setLongPressActivated(true);
      }
      longPressTimer.current = null;
    }, 430);
  }

  function startLongPress(event: React.PointerEvent, row: BookingItem) {
    if (event.pointerType !== "mouse") return;
    const target = event.target as HTMLElement;
    const currentTarget = event.currentTarget as HTMLElement;
    const interactive = target.closest("button,a,input,select,textarea");
    if (interactive && interactive !== currentTarget) return;
    event.stopPropagation();
    beginLongPress(row);
  }

  function startGroupLongPress(event: React.PointerEvent, groupKey: string) {
    if (event.pointerType !== "mouse") return;
    const target = event.target as HTMLElement;
    const currentTarget = event.currentTarget as HTMLElement;
    const interactive = target.closest("button,a,input,select,textarea");
    if (interactive && interactive !== currentTarget) return;
    beginGroupLongPress(groupKey);
  }

  function startTouchLongPress(event: React.TouchEvent, row: BookingItem) {
    const target = event.target as HTMLElement;
    const currentTarget = event.currentTarget as HTMLElement;
    const interactive = target.closest("button,a,input,select,textarea");
    if (interactive && interactive !== currentTarget) return;
    event.stopPropagation();
    const touch = event.touches[0];
    if (touch.clientX < 28 || touch.clientX > window.innerWidth - 28) return;
    touchStart.current = { x: touch.clientX, y: touch.clientY };
    beginLongPress(row);
  }

  function startGroupTouchLongPress(event: React.TouchEvent, groupKey: string) {
    const target = event.target as HTMLElement;
    const currentTarget = event.currentTarget as HTMLElement;
    const interactive = target.closest("button,a,input,select,textarea");
    if (interactive && interactive !== currentTarget) return;
    const touch = event.touches[0];
    if (touch.clientX < 28 || touch.clientX > window.innerWidth - 28) return;
    touchStart.current = { x: touch.clientX, y: touch.clientY };
    beginGroupLongPress(groupKey);
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

  const loadData = useCallback(async () => {
    setLoadingData(true);
    try {
      const [customerResult, packageResult, bookingResult] = await Promise.all([
        fetch("/api/resources/customers").then((res) => res.json() as Promise<ApiResult<CustomerItem[] | CustomerPage>>),
        fetch("/api/packages").then((res) => res.json() as Promise<ApiResult<PackageItem[]>>),
        fetch(completedOnly ? "/api/bookings?view=completed" : "/api/bookings").then((res) => res.json() as Promise<ApiResult<BookingItem[]>>),
      ]);
      const nextCustomers = customerListFromData(customerResult.data);
      if (customerResult.data) setCustomers(nextCustomers);
      if (packageResult.data) setPackages(packageResult.data);
      if (bookingResult.data) {
        setRows(
          bookingResult.data.map((booking) => {
            if (booking.customer || booking.customerId) return booking;
            const matchedCustomer = nextCustomers.find((customer) => customer.name.trim().toLowerCase() === String(booking.customerName ?? "").trim().toLowerCase());
            return matchedCustomer ? { ...booking, customerId: matchedCustomer.id, customer: matchedCustomer } : booking;
          }),
        );
      }
      if (customerResult.error && !/chưa đăng nhập/i.test(customerResult.error.message)) setMessage(customerResult.error.message);
      if (packageResult.error && !/chưa đăng nhập/i.test(packageResult.error.message)) setMessage(packageResult.error.message);
      if (bookingResult.error && !/chưa đăng nhập/i.test(bookingResult.error.message)) setMessage(bookingResult.error.message);
    } catch (err) {
      console.error("Booking load error:", err);
    } finally {
      setLoadingData(false);
    }
  }, [completedOnly]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadData(), 0);
    return () => window.clearTimeout(timer);
  }, [loadData]);

  useEffect(() => {
    if (showForm && !completedOnly) {
      document.body.classList.add("studio-modal-open");
      return () => {
        document.body.classList.remove("studio-modal-open");
      };
    } else {
      document.body.classList.remove("studio-modal-open");
    }
  }, [completedOnly, showForm]);

  useEffect(() => {
    if (!focusedItemId || !rows.length) return;
    const focusedRow = rows.find((row) => row.id === focusedItemId);
    const focusedGroupKey = focusedRow ? bookingGroupKey(focusedRow) : "";
    const targetId = focusedGroupKey ? `booking-group-${focusedGroupKey}` : focusedItemId;
    const timer = window.setTimeout(() => {
      if (focusedGroupKey) {
        setExpandedGroups((current) => current.includes(focusedGroupKey) ? current : [...current, focusedGroupKey]);
      }
      window.setTimeout(() => {
        const element = document.querySelector(`[data-row-id="${CSS.escape(targetId)}"]`);
        element?.scrollIntoView({ behavior: "smooth", block: "center" });
        element?.classList.add("studio-focus-highlight");
        window.setTimeout(() => {
          element?.classList.remove("studio-focus-highlight");
          setFocusedItemId(null);
        }, 2800);
      }, focusedGroupKey ? 90 : 0);
    }, focusedGroupKey ? 220 : 120);
    return () => window.clearTimeout(timer);
  }, [focusedItemId, rows, setFocusedItemId]);

  async function save() {
    setSaving(true);
    try {
      const groupNames = parseGroupCustomers(form.groupCustomers);
      const payloads = !editingId && form.bookingMode === "GROUP"
        ? groupNames.map((name, index) => ({ ...form, packageId: groupPackageIds[index] || form.packageId, customerId: "", customerName: name, imageUrl: "", id: null }))
        : [{ ...form, id: editingId, ...(editingId && role === "STAFF" ? { studioPassword: editStudioPassword } : {}) }];

      if (!editingId && form.bookingMode === "GROUP" && payloads.length === 0) {
        return setMessage("Vui lòng nhập danh sách khách cho booking nhóm.");
      }
      if (!editingId && form.bookingMode === "GROUP" && payloads.some((payload) => !payload.packageId)) {
        return setMessage("Vui lòng chọn gói cho từng khách trong booking nhóm.");
      }

      for (const payload of payloads) {
        const result = await fetch("/api/bookings", {
          method: editingId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }).then((res) => res.json() as Promise<ApiResult<BookingItem>>);

        if (result.error) return setMessage(result.error.message);
      }
      setForm(emptyForm);
      setGroupPackageIds([]);
      setEditingId(null);
      setEditStudioPassword("");
      setShowForm(false);
      setMessage(editingId ? "Đã cập nhật booking." : form.bookingMode === "GROUP" ? `Đã tạo ${payloads.length} booking nhóm.` : "Đã tạo booking.");
      await loadData();
    } finally {
      setSaving(false);
    }
  }

  async function remove(row: BookingItem, mode: "trash" | "hard") {
    setDeleting(true);
    try {
      const result = await fetch("/api/bookings", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: row.id, mode }),
      }).then((res) => res.json() as Promise<ApiResult<{ id: string }>>);

      if (result.error) return setMessage(result.error.message);
      setMessage(mode === "hard" ? "Đã xóa booking." : "Đã chuyển booking vào thùng rác.");
      setDetail(null);
      setDeleteTarget(null);
      setSelectedIds((current) => current.filter((id) => id !== row.id));
      setSelectedGroupKeys((current) => current.filter((key) => !displayGroups.some((group) => group.key === key && group.rows.some((item) => item.id === row.id))));
      await loadData();
    } finally {
      setDeleting(false);
    }
  }

  async function removeMany(mode: "trash" | "hard") {
    setDeleting(true);
    try {
      const selectedGroupRows = displayGroups.filter((group) => selectedGroupKeys.includes(group.key)).flatMap((group) => group.rows);
      const selectedRowIds = new Set([...selectedIds, ...selectedGroupRows.map((row) => row.id)]);
      const source = bulkDeleteMode === "all" ? filteredRows : filteredRows.filter((row) => selectedRowIds.has(row.id));
      for (const row of source) {
        const result = await fetch("/api/bookings", {
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
      setMessage(mode === "hard" ? `Đã xóa ${source.length} booking.` : `Đã chuyển ${source.length} booking vào thùng rác.`);
      setSelectedIds([]);
      setSelectedGroupKeys([]);
      setGroupSelectionMode(false);
      setBulkDeleteMode(null);
      await loadData();
    } finally {
      setDeleting(false);
    }
  }

  async function changeStatus(row: BookingItem, status: "CANCELLED" | "COMPLETED", printAfter = false, printWindow?: Window | null) {
    let studioPassword = "";
    if (role === "STAFF") {
      studioPassword = window.prompt("Nhập mật khẩu studio 6 số để cập nhật booking.")?.trim() ?? "";
      if (!/^\d{6}$/.test(studioPassword)) {
        printWindow?.close();
        setMessage("Nhân viên cần nhập đúng mật khẩu studio 6 số để cập nhật booking.");
        return;
      }
    }
    setProcessingStatus(true);
    try {
      const result = await fetch("/api/bookings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: row.id,
          customerId: row.customerId ?? "",
          customerName: row.customerName ?? "",
          imageUrl: row.imageUrl ?? "",
          packageId: row.packageId ?? "",
          startTime: row.startTime,
          endTime: row.endTime,
          note: row.note ?? "",
          status,
          ...(role === "STAFF" ? { studioPassword } : {}),
        }),
      }).then((res) => res.json() as Promise<ApiResult<BookingItem>>);

      if (result.error) {
        printWindow?.close();
        return setMessage(result.error.message);
      }
      setCancelTarget(null);
      setPaymentTarget(null);
      setDetail(null);
      setMessage(status === "COMPLETED" ? "Đã thanh toán, lưu hóa đơn và chuyển vào Booking hoàn tất." : "Đã hủy booking.");
      if (status === "COMPLETED" && printAfter) printBookingInvoice(result.data ?? row, printWindow);
      await loadData();
    } catch (err) {
      printWindow?.close();
      console.error("Change status error:", err);
    } finally {
      setProcessingStatus(false);
    }
  }

  async function changeGroupStatus(group: { key: string; title?: string; rows: BookingItem[] }, status: "COMPLETED", printAfter = false, printWindow?: Window | null) {
    let studioPassword = "";
    if (role === "STAFF") {
      studioPassword = window.prompt("Nhập mật khẩu studio 6 số để cập nhật thanh toán nhóm.")?.trim() ?? "";
      if (!/^\d{6}$/.test(studioPassword)) {
        printWindow?.close();
        setMessage("Nhân viên cần nhập đúng mật khẩu studio 6 số để cập nhật thanh toán nhóm.");
        return;
      }
    }
    setProcessingStatus(true);
    try {
      const targetRows = group.rows.filter(row => row.status !== "COMPLETED" && row.status !== "CANCELLED");
      const updatedRows: BookingItem[] = [];

      for (const row of targetRows) {
        const result = await fetch("/api/bookings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: row.id,
            customerId: row.customerId ?? "",
            customerName: row.customerName ?? "",
            imageUrl: row.imageUrl ?? "",
            packageId: row.packageId ?? "",
            startTime: row.startTime,
            endTime: row.endTime,
            note: row.note ?? "",
            status,
            ...(role === "STAFF" ? { studioPassword } : {}),
          }),
        }).then((res) => res.json() as Promise<ApiResult<BookingItem>>);

        if (result.error) {
          printWindow?.close();
          return setMessage(`Lỗi khi thanh toán cho khách ${row.customerName}: ${result.error.message}`);
        }
        updatedRows.push(result.data ?? row);
      }

      setCancelTarget(null);
      setPaymentTarget(null);
      setGroupPaymentTarget(null);
      setDetail(null);
      setMessage("Đã thanh toán nhóm thành công, lưu hóa đơn và chuyển vào Booking hoàn tất.");
      if (printAfter) {
        const printedGroup = { ...group, rows: group.rows.map(row => updatedRows.find(u => u.id === row.id) || row) };
        printBookingGroupInvoice(printedGroup, printWindow);
      }
      await loadData();
    } catch (err) {
      printWindow?.close();
      console.error("Change group status error:", err);
    } finally {
      setProcessingStatus(false);
    }
  }

  function edit(row: BookingItem) {
    let studioPassword = "";
    if (role === "STAFF") {
      studioPassword = window.prompt("Nhập mật khẩu studio 6 số để sửa booking.")?.trim() ?? "";
      if (!/^\d{6}$/.test(studioPassword)) {
        setMessage("Nhân viên cần nhập đúng mật khẩu studio 6 số để sửa booking.");
        return;
      }
    }
    setDetail(null);
    setEditingId(row.id);
    setEditStudioPassword(studioPassword);
    setShowForm(true);
    setForm({
      customerId: row.customerId ?? "",
      bookingMode: "PERSONAL",
      groupLabel: "",
      groupCustomers: "",
      customerName: row.customerName ?? "",
      imageUrl: row.imageUrl ?? "",
      packageId: row.packageId ?? "",
      packageName: row.packageName ?? "",
      categoryName: row.categoryName ?? "",
      price: String(row.price ?? 0),
      discountType: "NONE",
      discountValue: "",
      startTime: row.startTime ? String(row.startTime).slice(0, 16) : "",
      endTime: row.endTime ? String(row.endTime).slice(0, 16) : "",
      note: row.note ?? "",
      status: row.status ?? "PENDING",
    });
  }

  async function renameGroup(group: { key: string; title?: string; rows: BookingItem[] }) {
    const nextName = window.prompt("Nhập tên nhóm mới.", group.title ?? "")?.trim();
    if (!nextName || nextName === group.title) return;
    let studioPassword = "";
    if (role === "STAFF") {
      studioPassword = window.prompt("Nhập mật khẩu studio 6 số để sửa tên nhóm.")?.trim() ?? "";
      if (!/^\d{6}$/.test(studioPassword)) {
        setMessage("Nhân viên cần nhập đúng mật khẩu studio 6 số để sửa tên nhóm.");
        return;
      }
    }

    for (const row of group.rows) {
      const result = await fetch("/api/bookings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: row.id,
          customerId: row.customerId ?? "",
          customerName: row.customerName ?? "",
          imageUrl: row.imageUrl ?? "",
          packageId: row.packageId ?? "",
          startTime: row.startTime,
          endTime: row.endTime,
          note: renameBookingGroupNote(row.note, nextName),
          status: row.status ?? "PENDING",
          ...(role === "STAFF" ? { studioPassword } : {}),
        }),
      }).then((res) => res.json() as Promise<ApiResult<BookingItem>>);

      if (result.error) return setMessage(result.error.message);
    }
    setExpandedGroups((current) => current.filter((key) => key !== group.key));
    setSelectedGroupKeys((current) => current.filter((key) => key !== group.key));
    setGroupSelectionMode(false);
    setMessage(`Đã đổi tên nhóm thành "${nextName}".`);
    await loadData();
  }

  function resetForm() {
    setEditingId(null);
    setEditStudioPassword("");
    setGroupPackageIds([]);
    setForm(emptyForm);
    setShowForm(true);
  }

  const filteredRows = rows.filter((row) => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return true;
    return [row.customerName, row.packageName, row.categoryName, row.status, row.note].some((value) =>
      String(value ?? "").toLowerCase().includes(keyword),
    );
  });
  const allVisibleSelected = filteredRows.length > 0 && filteredRows.every((row) => selectedIds.includes(row.id));
  const groupNames = parseGroupCustomers(form.groupCustomers);
  const displayGroups = (() => {
    const groups: Array<{ key: string; title?: string; rows: BookingItem[] }> = [];
    const grouped = new Map<string, { title: string; rows: BookingItem[] }>();
    for (const row of filteredRows) {
      const title = bookingGroupName(row.note);
      const key = bookingGroupKey(row);
      if (!title || !key) {
        groups.push({ key: row.id, rows: [row] });
        continue;
      }
      const current = grouped.get(key) ?? { title, rows: [] };
      current.rows.push(row);
      grouped.set(key, current);
    }
    return [
      ...groups,
      ...Array.from(grouped.entries()).map(([key, value]) => ({ key, title: value.title, rows: value.rows })),
    ].sort((a, b) => new Date(String(b.rows[0]?.createdAt ?? b.rows[0]?.startTime ?? "")).getTime() - new Date(String(a.rows[0]?.createdAt ?? a.rows[0]?.startTime ?? "")).getTime());
  })();
  const visibleGroupKeys = displayGroups.filter((group) => group.title).map((group) => group.key);
  const selectedGroupRows = displayGroups.filter((group) => selectedGroupKeys.includes(group.key)).flatMap((group) => group.rows);
  const selectedDeleteCount = new Set([...selectedIds, ...selectedGroupRows.map((row) => row.id)]).size;
  const progressiveGroups = useProgressiveList(displayGroups, 50);

  function renderBookingRow(row: BookingItem, index: number, total: number) {
    const isDiscounted = Number(row.total ?? row.price) < Number(row.price);
    const displayNote = (row.note ?? "").replace(/Loại booking:\s*Booking nhóm(?:\s*-\s*[^\n.]+)?\.?/i, "").trim();

    return (
      <div
        key={row.id}
        data-row-id={row.id}
        role="button"
        tabIndex={0}
        onClick={() => {
          if (longPressActivated) {
            setLongPressActivated(false);
            return;
          }
          if (selectedIds.length > 0 || selectedGroupKeys.length > 0) {
            setSelectedIds((current) => {
              const isUnselecting = current.includes(row.id);
              const next = isUnselecting ? current.filter((id) => id !== row.id) : [...current, row.id];
              
              if (isUnselecting) {
                const groupKey = bookingGroupKey(row);
                if (groupKey) {
                  setSelectedGroupKeys((gKeys) => gKeys.filter((key) => key !== groupKey));
                }
              } else {
                const groupKey = bookingGroupKey(row);
                if (groupKey) {
                  const group = displayGroups.find((g) => g.key === groupKey);
                  if (group && group.rows.every((r) => r.id === row.id || next.includes(r.id))) {
                    setSelectedGroupKeys((gKeys) => gKeys.includes(groupKey) ? gKeys : [...gKeys, groupKey]);
                  }
                }
              }
              return next;
            });
            return;
          }
          setDetail(row);
        }}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          if (longPressActivated) {
            setLongPressActivated(false);
            return;
          }
          if (selectedIds.length > 0 || selectedGroupKeys.length > 0) {
            setSelectedIds((current) => {
              const isUnselecting = current.includes(row.id);
              const next = isUnselecting ? current.filter((id) => id !== row.id) : [...current, row.id];
              
              if (isUnselecting) {
                const groupKey = bookingGroupKey(row);
                if (groupKey) {
                  setSelectedGroupKeys((gKeys) => gKeys.filter((key) => key !== groupKey));
                }
              } else {
                const groupKey = bookingGroupKey(row);
                if (groupKey) {
                  const group = displayGroups.find((g) => g.key === groupKey);
                  if (group && group.rows.every((r) => r.id === row.id || next.includes(r.id))) {
                    setSelectedGroupKeys((gKeys) => gKeys.includes(groupKey) ? gKeys : [...gKeys, groupKey]);
                  }
                }
              }
              return next;
            });
            return;
          }
          setDetail(row);
        }}
        onPointerDown={(event) => startLongPress(event, row)}
        onPointerUp={(event) => { event.stopPropagation(); clearLongPress(); }}
        onPointerCancel={(event) => { event.stopPropagation(); clearLongPress(); }}
        onPointerLeave={(event) => { event.stopPropagation(); clearLongPress(); }}
        onTouchStart={(event) => startTouchLongPress(event, row)}
        onTouchMove={(event) => { event.stopPropagation(); moveTouchLongPress(event); }}
        onTouchEnd={(event) => { event.stopPropagation(); endTouchLongPress(); }}
        onTouchCancel={(event) => { event.stopPropagation(); endTouchLongPress(); }}
        className="relative mt-6 w-full cursor-pointer rounded-[1.75rem] border border-[#F4C7C4] bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md active:scale-[0.99]"
      >
        <span className="absolute -top-3 left-5 rounded-full border border-[#F4C7C4] bg-[#FFF0F4] px-3 py-1 text-[11px] font-black text-[#C14F69] shadow-sm">
          {bookingDateBadge(row.startTime)}
        </span>

        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            {selectedIds.length > 0 || selectedGroupKeys.length > 0 || selectedIds.includes(row.id) ? (
              <span
                role="checkbox"
                aria-checked={selectedIds.includes(row.id)}
                tabIndex={0}
                onClick={(event) => {
                  event.stopPropagation();
                  setSelectedIds((current) => {
                    const isUnselecting = current.includes(row.id);
                    const next = isUnselecting ? current.filter((id) => id !== row.id) : [...current, row.id];
                    
                    if (isUnselecting) {
                      const groupKey = bookingGroupKey(row);
                      if (groupKey) {
                        setSelectedGroupKeys((gKeys) => gKeys.filter((key) => key !== groupKey));
                      }
                    } else {
                      const groupKey = bookingGroupKey(row);
                      if (groupKey) {
                        const group = displayGroups.find((g) => g.key === groupKey);
                        if (group && group.rows.every((r) => r.id === row.id || next.includes(r.id))) {
                          setSelectedGroupKeys((gKeys) => gKeys.includes(groupKey) ? gKeys : [...gKeys, groupKey]);
                        }
                      }
                    }
                    return next;
                  });
                }}
                className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl border text-[12px] font-black transition ${selectedIds.includes(row.id) ? "border-[#EA7188] bg-[#EA7188] text-white shadow-[0_0_0_4px_rgba(234,113,136,0.18)] scale-105" : "border-[#F4C7C4] bg-white text-[#EA7188]"}`}
              >
                {selectedIds.includes(row.id) ? "✓" : ""}
              </span>
            ) : (
              <OrderBadge value={total - index} />
            )}
            <CustomerAvatar booking={row} />
            <div className="min-w-0">
              <h2 className="whitespace-normal break-words text-lg font-black leading-tight text-[#5B342C]">{row.customerName || "Khách chưa đặt tên"}</h2>
              <div className="mt-1 flex items-center gap-1.5">
                <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#EA7188]" />
                <p className="truncate text-sm font-bold text-[#9B746B]">{row.packageName || "Chưa có gói"}</p>
              </div>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-base font-black text-[#EA7188]">{formatMoney(row.total ?? row.price)}</p>
            {isDiscounted ? <p className="text-[10px] font-bold text-emerald-600">Đã giảm giá</p> : null}
          </div>
        </div>

        {displayNote ? (
          <div className="mt-3 rounded-[1.25rem] bg-[#FFF8F1] p-3">
            <p className="line-clamp-2 text-xs font-semibold leading-relaxed text-[#7B554D]">
              <span className="font-black text-[#EA7188]">Ghi chú:</span> {displayNote}
            </p>
          </div>
        ) : null}

        {!completedOnly ? (
          <div className="mt-4 grid grid-cols-4 gap-1.5">
            <Button variant="secondary" size="sm" className="h-9 rounded-xl text-xs font-bold gap-1 px-1.5" onClick={(event) => { event.stopPropagation(); edit(row); }}>
              <Pencil size={13} className="shrink-0 text-[#EA7188]" />
              Sửa
            </Button>
            <Button variant="danger" size="sm" className="h-9 rounded-xl text-xs font-bold gap-1 px-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 hover:text-rose-800" onClick={(event) => { event.stopPropagation(); setDeleteTarget(row); }}>
              <Trash2 size={13} className="shrink-0" />
              Xóa
            </Button>
            <Button variant="secondary" size="sm" className="h-9 rounded-xl text-xs font-bold gap-1 px-1.5" onClick={(event) => { event.stopPropagation(); setCancelTarget(row); }}>
              <X size={13} className="shrink-0 text-amber-600" />
              Hủy
            </Button>
            <Button size="sm" className="h-9 rounded-xl text-xs font-bold gap-1 px-1.5 bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm" onClick={(event) => { event.stopPropagation(); setPaymentTarget(row); }}>
              <CheckCircle2 size={13} className="shrink-0" />
              Xong
            </Button>
          </div>
        ) : (
          <div className="mt-4">
            <Button variant="danger" size="sm" className="h-9 w-full rounded-xl text-xs font-bold gap-1 px-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 hover:text-rose-800" onClick={(event) => { event.stopPropagation(); setDeleteTarget(row); }}>
              <Trash2 size={13} className="shrink-0" />
              Xóa lịch sử
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <StudioBrandPanel
        eyebrow={completedOnly ? "Quản lý" : "Booking"}
        title={completedOnly ? "Booking hoàn tất" : "Booking"}
        description={completedOnly ? "Lưu các booking đã hoàn tất và đã cộng vào doanh thu." : "Booking đang xử lý. Khi chuyển sang Hoàn tất, lịch sẽ tự chuyển qua mục Booking hoàn tất."}
        actions={
          !completedOnly && role !== "STAFF" ? (
            <Button className="min-h-11 w-full sm:w-auto" onClick={resetForm}>
              <Plus size={17} />
              Mới
            </Button>
          ) : null
        }
      />
      <section className="hidden">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.16em] text-[#EA7188]">{completedOnly ? "Lịch đã xong" : "Lịch hẹn"}</p>
          <h1 className="mt-1 text-3xl font-black text-[#5B342C]">{completedOnly ? "Booking hoàn tất" : "Booking"}</h1>
          <p className="mt-2 text-sm font-semibold text-[#9B746B]">
            {completedOnly ? "Lưu các booking đã hoàn tất và đã cộng vào doanh thu." : "Booking đang xử lý. Khi chuyển sang Hoàn tất, lịch sẽ tự chuyển qua mục Booking hoàn tất."}
          </p>
        </div>
        {!completedOnly ? (
          <Button className="min-h-11 w-full sm:w-auto" onClick={resetForm}>
            <Plus size={17} />
            Mới
          </Button>
        ) : null}
      </section>

      <AlertModal isOpen={!!message} message={message} onClose={() => setMessage("")} />

      <div className="flex items-center gap-2 rounded-2xl border border-[#F4C7C4] bg-white px-4 py-3 shadow-sm">
        <Search size={18} className="shrink-0 text-[#EA7188]" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Tìm booking, khách, gói..."
          className="h-8 min-w-0 flex-1 bg-transparent text-sm font-semibold text-[#5B342C] outline-none placeholder:text-[#B98278]"
        />
      </div>

      <div className="hidden">
        <label className="text-xs font-black uppercase text-[#B98278]">
          Từ ngày
          <input
            type="date"
            value={fromDate}
            onChange={(event) => setFromDate(event.target.value)}
            className="mt-1 h-10 w-full rounded-xl border border-[#F1C5C1] bg-[#FFF9F4] px-3 text-sm font-semibold normal-case text-[#5B342C] outline-none"
          />
        </label>
        <label className="text-xs font-black uppercase text-[#B98278]">
          Đến ngày
          <input
            type="date"
            value={toDate}
            onChange={(event) => setToDate(event.target.value)}
            className="mt-1 h-10 w-full rounded-xl border border-[#F1C5C1] bg-[#FFF9F4] px-3 text-sm font-semibold normal-case text-[#5B342C] outline-none"
          />
        </label>
        {fromDate || toDate ? (
          <button type="button" className="h-10 rounded-xl bg-[#FFF0F4] px-3 text-sm font-black text-[#EA7188]" onClick={() => { setFromDate(""); setToDate(""); }}>
            Xóa lọc
          </button>
        ) : null}
      </div>

      <div className={completedOnly || !showForm ? "grid gap-5" : "grid gap-5 xl:grid-cols-[1fr_420px]"}>
        <div className="space-y-3">
          {filteredRows.length && role === "ADMIN" ? (
            <div className="flex flex-col gap-2 rounded-2xl border border-[#F4C7C4] bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
              <label className="flex items-center gap-2 text-sm font-black text-[#5B342C]">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[#EA7188]"
                  checked={allVisibleSelected}
                  onChange={(event) => {
                    setSelectedIds(event.target.checked ? filteredRows.map((row) => row.id) : []);
                    setSelectedGroupKeys(event.target.checked ? visibleGroupKeys : []);
                    setGroupSelectionMode(event.target.checked && visibleGroupKeys.length > 0);
                  }}
                />
                Chọn tất cả ({filteredRows.length})
              </label>
              <div className="grid grid-cols-2 gap-2 sm:flex">
                <Button variant="secondary" size="sm" disabled={!selectedDeleteCount} onClick={() => setBulkDeleteMode("selected")}>
                  Xóa đã chọn ({selectedDeleteCount})
                </Button>
                <Button variant="danger" size="sm" onClick={() => setBulkDeleteMode("all")}>
                  Xóa tất cả
                </Button>
              </div>
            </div>
          ) : null}
          {loadingData ? (
            <Card className="py-12 flex flex-col items-center justify-center gap-3 text-center font-semibold text-[#9B746B]">
              <Loader2 className="h-8 w-8 animate-spin text-[#EA7188]" />
              <span>Đang tải dữ liệu...</span>
            </Card>
          ) : filteredRows.length === 0 ? (
            <Card className="py-12 text-center font-semibold text-[#9B746B]">
              {completedOnly ? "Chưa có booking hoàn tất" : "Chưa có booking đang xử lý"}
            </Card>
          ) : null}
          {!loadingData && progressiveGroups.visibleItems.map((group, groupIndex) => {
            if (!group.title) return renderBookingRow(group.rows[0], groupIndex, displayGroups.length);
            const expanded = expandedGroups.includes(group.key);
            const packageNames = [...new Set(group.rows.map((row) => row.packageName).filter(Boolean))];
            const selected = selectedGroupKeys.includes(group.key);
            const showGroupCheckbox = groupSelectionMode || selectedGroupKeys.length > 0 || selected;
            const uncompletedRows = group.rows.filter((row) => row.status !== "COMPLETED" && row.status !== "CANCELLED");

            return (
              <div
                key={group.key}
                data-row-id={`booking-group-${group.key}`}
                onPointerDown={(event) => startGroupLongPress(event, group.key)}
                onPointerUp={clearLongPress}
                onPointerCancel={clearLongPress}
                onPointerLeave={clearLongPress}
                onTouchStart={(event) => startGroupTouchLongPress(event, group.key)}
                onTouchMove={moveTouchLongPress}
                onTouchEnd={endTouchLongPress}
                onTouchCancel={endTouchLongPress}
                className={`rounded-[1.5rem] border p-3 shadow-sm transition ${selected ? "border-[#EA7188] bg-[#FFF0F4] shadow-[0_0_0_4px_rgba(234,113,136,0.13)]" : "border-[#F4C7C4] bg-[#FFF8F1]"}`}
              >
                <div
                  role="button"
                  tabIndex={0}
                  className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-[1.25rem] bg-white px-3 py-3 text-left shadow-sm transition active:scale-[0.99]"
                  onClick={() => {
                    if (longPressActivated) {
                      setLongPressActivated(false);
                      return;
                    }
                    setExpandedGroups((current) => current.includes(group.key) ? current.filter((item) => item !== group.key) : [...current, group.key]);
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" && event.key !== " ") return;
                    event.preventDefault();
                    setExpandedGroups((current) => current.includes(group.key) ? current.filter((item) => item !== group.key) : [...current, group.key]);
                  }}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    {showGroupCheckbox ? (
                      <button
                        type="button"
                        aria-pressed={selected}
                        aria-label={selected ? "Bỏ chọn nhóm" : "Chọn nhóm"}
                        onClick={(event) => {
                          event.stopPropagation();
                          toggleGroupSelection(group.key);
                        }}
                        className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl border text-[12px] font-black transition ${selected ? "scale-105 border-[#EA7188] bg-[#EA7188] text-white shadow-[0_0_0_4px_rgba(234,113,136,0.18)]" : "border-[#F4C7C4] bg-white text-[#EA7188]"}`}
                      >
                        {selected ? "✓" : ""}
                      </button>
                    ) : null}
                    <div className="min-w-0">
                      <p className="text-xs font-black uppercase tracking-wide text-[#EA7188]">Booking nhóm</p>
                      <h2 className="mt-1 whitespace-normal break-words text-lg font-black text-[#5B342C]">{group.title}</h2>
                      <p className="mt-1 whitespace-normal break-words text-sm font-semibold text-[#9B746B]">
                        {group.rows.length} khách · {packageNames.length <= 1 ? (packageNames[0] ?? "Chưa có gói") : `${packageNames.length} gói khác nhau`}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {!completedOnly && uncompletedRows.length > 0 ? (
                      <button
                        type="button"
                        className="rounded-full bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 text-xs font-black text-emerald-600 transition"
                        onClick={(event) => {
                          event.stopPropagation();
                          setGroupPaymentTarget(group);
                        }}
                      >
                        Thanh toán ({uncompletedRows.length})
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="rounded-full bg-[#FFF0F4] px-3 py-1.5 text-xs font-black text-[#A84E61] transition hover:bg-[#FFE2EA]"
                      onClick={(event) => {
                        event.stopPropagation();
                        void renameGroup(group);
                      }}
                    >
                      Sửa tên
                    </button>
                    <span className="rounded-full bg-[#FFF0F4] px-3 py-1.5 text-xs font-black text-[#A84E61]">
                      {expanded ? "Thu gọn" : "Xem"}
                    </span>
                  </div>
                </div>
                {expanded ? (
                  <div className="mt-3 grid gap-2">
                    {group.rows.map((row, index) => renderBookingRow(row, index, group.rows.length))}
                  </div>
                ) : null}
              </div>
            );
          })}
          <ProgressiveListSentinel refTarget={progressiveGroups.sentinelRef} hasMore={progressiveGroups.hasMore} />
      </div>

      {(() => {
        if (completedOnly || !showForm) return null;
        const formElement = (
          <div ref={formRef} className="scroll-mt-20">
            <button className="studio-mobile-form-backdrop sm:hidden" aria-label="Đóng form" onClick={() => { setEditingId(null); setForm(emptyForm); setShowForm(false); }} />
            <Card className="studio-mobile-form-sheet h-fit xl:sticky xl:top-24">
              <div className="mb-3 flex justify-end">
                <Button variant="secondary" size="icon" aria-label="Đóng form" onClick={() => { setEditingId(null); setForm(emptyForm); setShowForm(false); }}>
                  <X size={16} />
                </Button>
              </div>
              <CardTitle>{editingId ? "Sửa booking" : "Thêm booking"}</CardTitle>
              <div className="mt-4 space-y-4">
                {!editingId ? (
                  <div className="grid grid-cols-2 gap-2 rounded-2xl bg-[#FFF3EC] p-2">
                    {[
                      ["PERSONAL", "Booking cá nhân"],
                      ["GROUP", "Booking nhóm"],
                    ].map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        className={`min-h-11 rounded-xl px-3 text-sm font-black transition ${form.bookingMode === value ? "bg-[#EA7188] text-white shadow-sm" : "bg-white text-[#9B746B] hover:text-[#5B342C]"}`}
                        onClick={() => setForm((current) => ({ ...current, bookingMode: value }))}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                ) : null}
                <CustomerSearchPicker
                  customers={customers}
                  selectedId={form.customerId}
                  selectedName={form.customerName}
                  onPick={(customer) => setForm((current) => ({ ...current, customerId: customer.id, customerName: customer.name, imageUrl: "" }))}
                  onClear={() => setForm((current) => ({ ...current, customerId: "", customerName: "", imageUrl: "" }))}
                />
                <select
                  className="hidden h-12 w-full rounded-xl border border-[#F4C7C4] bg-white px-4 text-sm font-semibold text-[#5B342C]"
                  value=""
                  onChange={(event) => {
                    const customer = customers.find((item) => item.id === event.target.value);
                    if (customer) setForm((current) => ({ ...current, customerId: customer.id, customerName: customer.name, imageUrl: "" }));
                  }}
                >
                  <option value="">Chọn khách CRM</option>
                  {customers.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} {item.phone ? `- ${item.phone}` : ""}
                    </option>
                  ))}
                </select>
                {form.bookingMode === "GROUP" && !editingId ? (
                  <div className="space-y-3 rounded-2xl border border-[#F4C7C4] bg-[#FFF8F1] p-3">
                    <Input value={form.groupLabel} placeholder="Tên nhóm / đoàn (ví dụ: Nhóm bạn Linh)" onChange={(event) => setForm((current) => ({ ...current, groupLabel: event.target.value }))} />
                    <Textarea
                      className="min-h-32"
                      value={form.groupCustomers}
                      placeholder={"Nhập mỗi khách một dòng:\nNguyễn Minh Anh\nTrần Bảo Ngọc\nLê Hoàng Nam"}
                      onChange={(event) => {
                        const nextNames = parseGroupCustomers(event.target.value);
                        setGroupPackageIds((current) => nextNames.map((_, index) => current[index] ?? form.packageId));
                        setForm((current) => ({ ...current, groupCustomers: event.target.value }));
                      }}
                    />
                    {groupNames.length ? (
                      <div className="space-y-2">
                        <p className="text-xs font-black uppercase tracking-wide text-[#C87888]">Gói riêng từng khách</p>
                        {groupNames.map((name, index) => (
                          <div key={`${name}-${index}`} className="grid gap-2 rounded-2xl bg-white p-2 sm:grid-cols-[1fr_1.4fr] sm:items-center">
                            <p className="min-w-0 whitespace-normal break-words text-sm font-black text-[#5B342C]">{index + 1}. {name}</p>
                            <select
                              className="h-11 w-full rounded-xl border border-[#F4C7C4] bg-white px-3 text-sm font-semibold text-[#5B342C]"
                              value={groupPackageIds[index] || form.packageId}
                              onChange={(event) => setGroupPackageIds((current) => {
                                const next = [...current];
                                next[index] = event.target.value;
                                return next;
                              })}
                            >
                              <option value="">Chọn gói cho khách này</option>
                              {packages.map((item) => (
                                <option key={item.id} value={item.id}>
                                  {item.name} - {formatMoney(item.price)}
                                </option>
                              ))}
                            </select>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    <p className="text-xs font-bold text-[#9B746B]">Mỗi tên sẽ tạo 1 booking riêng trong cùng nhóm. Có thể chọn gói khác nhau cho từng khách.</p>
                  </div>
                ) : (
                  <Input value={form.customerName} placeholder="Tên khách" onChange={(event) => setForm((current) => ({ ...current, customerId: "", customerName: event.target.value }))} />
                )}
                {form.bookingMode === "PERSONAL" && !form.customerId && form.customerName.trim() ? (
                  <div className="rounded-2xl bg-[#FFF8F1] p-3">
                    <p className="mb-2 text-sm font-black text-[#5B342C]">Ảnh khách lạ</p>
                    <MediaPicker value={form.imageUrl} onChange={(value) => setForm((current) => ({ ...current, imageUrl: value }))} placeholder="Upload ảnh khách lạ" />
                  </div>
                ) : null}
                <select
                  className="h-12 w-full rounded-xl border border-[#F4C7C4] bg-white px-4 text-sm font-semibold text-[#5B342C]"
                  value={form.packageId}
                  onChange={(event) => {
                    const nextPackage = packages.find((item) => item.id === event.target.value);
                    if (form.bookingMode === "GROUP" && !editingId) setGroupPackageIds(groupNames.map(() => event.target.value));
                    setForm((current) => ({
                      ...current,
                      packageId: event.target.value,
                      packageName: nextPackage?.name ?? "",
                      categoryName: nextPackage?.category.name ?? "",
                      price: String(nextPackage?.price ?? 0),
                    }));
                  }}
                >
                  <option value="">Chọn gói</option>
                  {packages.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} - {formatMoney(item.price)}
                    </option>
                  ))}
                </select>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input value={form.packageName} readOnly placeholder="Tên gói" />
                  <Input value={form.categoryName} readOnly placeholder="Danh mục" />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input value={formatMoney(form.price)} readOnly />
                  <div className="rounded-xl border border-[#F4C7C4] bg-[#FFF8F1] px-4 py-3">
                    <p className="text-xs font-black uppercase text-[#B98278]">Sau giảm</p>
                    <p className="mt-1 text-base font-black text-[#5B342C]">{formatMoney(discountedTotal(form.price, form.discountType, form.discountValue).total)}</p>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-[1fr_1.2fr]">
                  <select
                    className="h-12 w-full rounded-xl border border-[#F4C7C4] bg-white px-4 text-sm font-semibold text-[#5B342C]"
                    value={form.discountType}
                    onChange={(event) => setForm((current) => ({ ...current, discountType: event.target.value, discountValue: event.target.value === "NONE" ? "" : current.discountValue }))}
                  >
                    <option value="NONE">Không giảm giá</option>
                    <option value="AMOUNT">Giảm tiền mặt</option>
                    <option value="PERCENT">Giảm phần trăm</option>
                  </select>
                  <Input
                    disabled={form.discountType === "NONE"}
                    value={form.discountValue}
                    placeholder={form.discountType === "PERCENT" ? "Ví dụ: 10 (%)" : "Ví dụ: 50000"}
                    onChange={(event) => setForm((current) => ({ ...current, discountValue: event.target.value }))}
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <DateTimeInput label="Giờ bắt đầu" value={form.startTime} onChange={(event) => setForm((current) => ({ ...current, startTime: event.target.value }))} />
                  <DateTimeInput label="Giờ kết thúc" value={form.endTime} onChange={(event) => setForm((current) => ({ ...current, endTime: event.target.value }))} />
                </div>
                <select
                  className="h-12 w-full rounded-xl border border-[#F4C7C4] bg-white px-4 text-sm font-semibold text-[#5B342C]"
                  value={form.status}
                  onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}
                >
                  {["PENDING", "CONFIRMED", "IN_PROGRESS", "COMPLETED", "CANCELLED"].map((item) => (
                    <option key={item} value={item}>
                      {viOption(item)}
                    </option>
                  ))}
                </select>
                <Textarea placeholder="Ghi chú" value={form.note} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-2 mt-5">
                {editingId ? (
                  <Button variant="secondary" className="min-h-11" onClick={resetForm}>
                    Hủy sửa
                  </Button>
                ) : null}
                <Button className={`min-h-11 ${!editingId ? 'col-span-2' : ''}`} onClick={save} disabled={saving}>
                  {saving ? <><Loader2 size={16} className="animate-spin mr-2" />{editingId ? "Đang cập nhật..." : "Đang lưu..."}</> : editingId ? "Cập nhật" : "Lưu booking"}
                </Button>
              </div>
              {/* Thêm khoảng trống ở cuối để không bị che bởi menu/nav bar điện thoại */}
              <div className="h-20 sm:hidden" />
            </Card>
          </div>
        );
        return isMobile ? <Portal>{formElement}</Portal> : formElement;
      })()}
      </div>

      {detail ? (
        <BookingDetailModal
          booking={detail}
          completedOnly={completedOnly}
          canDelete={role === "ADMIN"}
          onClose={() => setDetail(null)}
          onEdit={edit}
          onRemove={(booking) => setDeleteTarget(booking)}
          onCancel={(booking) => setCancelTarget(booking)}
          onComplete={(booking) => setPaymentTarget(booking)}
        />
      ) : null}
      <ActionConfirmModal
        open={Boolean(cancelTarget)}
        title="Hủy đơn"
        description={`Bạn có chắc chắn hủy đơn "${cancelTarget?.customerName ?? ""}"?`}
        confirmLabel="Hủy đơn"
        danger
        onCancel={() => setCancelTarget(null)}
        onConfirm={() => cancelTarget ? void changeStatus(cancelTarget, "CANCELLED") : undefined}
        loading={processingStatus}
      />
      <PaymentConfirmModal
        booking={paymentTarget}
        onCancel={() => setPaymentTarget(null)}
        onPay={() => paymentTarget ? void changeStatus(paymentTarget, "COMPLETED") : undefined}
        onPayAndPrint={() => {
          if (!paymentTarget) return;
          const printWindow = window.open("", "_blank", "width=900,height=1000");
          void changeStatus(paymentTarget, "COMPLETED", true, printWindow);
        }}
        loading={processingStatus}
      />
      <GroupPaymentConfirmModal
        group={groupPaymentTarget}
        onCancel={() => setGroupPaymentTarget(null)}
        onPay={() => groupPaymentTarget ? void changeGroupStatus(groupPaymentTarget, "COMPLETED") : undefined}
        onPayAndPrint={() => {
          if (!groupPaymentTarget) return;
          const printWindow = window.open("", "_blank", "width=900,height=1000");
          void changeGroupStatus(groupPaymentTarget, "COMPLETED", true, printWindow);
        }}
        loading={processingStatus}
      />
      <DeleteConfirmation
        open={Boolean(deleteTarget)}
        description={`Bạn có chắc chắn muốn xóa booking "${deleteTarget?.customerName ?? ""}"?`}
        onHardDelete={() => deleteTarget ? void remove(deleteTarget, "hard") : undefined}
        onMoveToTrash={() => deleteTarget ? void remove(deleteTarget, "trash") : undefined}
        onCancel={() => deleting ? undefined : setDeleteTarget(null)}
        loading={deleting}
      />
      <DeleteConfirmation
        open={Boolean(bulkDeleteMode)}
        description={bulkDeleteMode === "all" ? `Bạn có chắc chắn muốn xóa tất cả ${filteredRows.length} booking đang hiển thị?` : `Bạn có chắc chắn muốn xóa ${selectedDeleteCount} booking đã chọn?`}
        onHardDelete={() => void removeMany("hard")}
        onMoveToTrash={() => void removeMany("trash")}
        onCancel={() => deleting ? undefined : setBulkDeleteMode(null)}
        loading={deleting}
      />
    </div>
  );
}

function BookingDetailModal({
  booking,
  completedOnly,
  canDelete,
  onClose,
  onEdit,
  onRemove,
  onCancel,
  onComplete,
}: {
  booking: BookingItem;
  completedOnly: boolean;
  canDelete: boolean;
  onClose: () => void;
  onEdit: (booking: BookingItem) => void;
  onRemove: (booking: BookingItem) => void;
  onCancel: (booking: BookingItem) => void;
  onComplete: (booking: BookingItem) => void;
}) {
  return (
    <DetailModal
      onClose={onClose}
      maxWidth="max-w-2xl"
      scrollKey={booking.id}
      header={
        <div className="flex min-w-0 items-start gap-3">
          <CustomerAvatar booking={booking} large />
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#EA7188]">Chi tiết booking</p>
            <h2 className="mt-1 whitespace-normal break-words text-xl font-black leading-7 text-[#5B342C] sm:text-2xl sm:leading-8">{booking.customerName || "Khách chưa đặt tên"}</h2>
            <p className="mt-0.5 text-sm font-semibold text-[#9B746B]">{booking.packageName || "Chưa có gói"}</p>
          </div>
        </div>
      }
      footer={
        <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
          {!completedOnly ? (
            <>
              <Button variant="secondary" className="min-h-11" onClick={() => onEdit(booking)}>
                <Pencil size={16} />
                Sửa
              </Button>
              <Button variant="secondary" className="min-h-11" onClick={() => onCancel(booking)}>
                <X size={16} />
                Hủy
              </Button>
              <Button className="min-h-11" onClick={() => onComplete(booking)}>
                <CheckCircle2 size={16} />
                Hoàn thành
              </Button>
            </>
          ) : null}
          {canDelete ? (
            <Button variant="danger" className="min-h-11" onClick={() => onRemove(booking)}>
              <Trash2 size={16} />
              Xóa
            </Button>
          ) : null}
        </div>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <DetailBox label="Khách" value={booking.customerName || "Không có"} />
        <DetailBox label="Trạng thái" value={viOption(booking.status)} />
        <DetailBox label="Gói" value={booking.packageName || "Không có"} />
        <DetailBox label="Danh mục" value={booking.categoryName || "Không có"} />
        <DetailBox label="Giá gốc" value={formatMoney(booking.price)} />
        <DetailBox label="Thanh toán" value={formatMoney(booking.total ?? booking.price)} />
        <DetailBox label="Ngày tạo" value={formatDate(booking.createdAt)} />
        <DetailBox label="Bắt đầu" value={formatDate(booking.startTime ?? "")} />
        <DetailBox label="Kết thúc" value={formatDate(booking.endTime ?? "")} />
      </div>

      <div className="mt-3 rounded-[1.25rem] bg-[#FFF3EC] p-4">
        <p className="text-xs font-black uppercase tracking-[0.12em] text-[#9B746B]">Ghi chú</p>
        <p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-6 text-[#5B342C]">{booking.note || "Không có ghi chú."}</p>
      </div>
    </DetailModal>
  );
}

function CustomerAvatar({ booking, large = false }: { booking: BookingItem; large?: boolean }) {
  const image = booking.customer?.avatarUrl || booking.imageUrl;
  const size = large ? "h-14 w-14 rounded-2xl" : "h-12 w-12 rounded-2xl";

  if (image) {
    return (
      <div className={`${size} shrink-0 overflow-hidden border border-[#F4C7C4] bg-[#FFF3EC] shadow-sm`}>
        <img src={image} alt={booking.customerName || "Khách"} className="h-full w-full object-cover" />
      </div>
    );
  }

  return (
    <div className={`grid ${size} shrink-0 place-items-center bg-[#FFF3EC] text-[#5B342C]`}>
      <CalendarClock size={large ? 24 : 22} />
    </div>
  );
}

function PackageThumb({ booking }: { booking: BookingItem }) {
  const image = booking.package?.imageUrl;
  if (!image) return null;
  return (
    <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl border border-[#F4C7C4] bg-[#FFF3EC] shadow-sm">
      <img src={image} alt={booking.packageName || "Gói"} className="h-full w-full object-cover" />
      <span className="absolute bottom-0 left-0 right-0 bg-white/92 px-1 py-0.5 text-center text-[9px] font-black text-[#A84E61] shadow-sm">
        Gói chụp
      </span>
    </div>
  );
}

function ActionConfirmModal({
  open,
  title,
  description,
  confirmLabel,
  danger = false,
  onCancel,
  onConfirm,
  loading = false,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  danger?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  loading?: boolean;
}) {
  if (!open) return null;
  return (
    <Portal>
      <div className="fixed inset-0 z-[150] grid place-items-center bg-[#2F1E1A]/45 p-4 backdrop-blur-sm" onClick={onCancel}>
        <div className="w-full max-w-md rounded-[2rem] border border-[#F4C7C4] bg-white p-5 shadow-[0_24px_80px_rgba(91,52,44,0.28)]" onClick={(event) => event.stopPropagation()}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#EA7188]">Xác nhận</p>
              <h3 className="mt-1 text-2xl font-black text-[#5B342C]">{title}</h3>
            </div>
            <button type="button" className="grid h-10 w-10 place-items-center rounded-2xl border border-[#F4C7C4] bg-white text-[#5B342C]" onClick={onCancel} disabled={loading}>
              <X size={18} />
            </button>
          </div>
          <p className="mt-4 text-sm font-semibold leading-6 text-[#7B554D]">{description}</p>
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            <Button variant="secondary" className="min-h-11" onClick={onCancel} disabled={loading}>
              Hủy
            </Button>
            <Button variant={danger ? "danger" : "accent"} className="min-h-11" onClick={onConfirm} disabled={loading}>
              {loading ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
              {confirmLabel}
            </Button>
          </div>
        </div>
      </div>
    </Portal>
  );
}

function PaymentConfirmModal({
  booking,
  onCancel,
  onPay,
  onPayAndPrint,
  loading = false,
}: {
  booking: BookingItem | null;
  onCancel: () => void;
  onPay: () => void;
  onPayAndPrint: () => void;
  loading?: boolean;
}) {
  if (!booking) return null;
  return (
    <Portal>
      <div className="fixed inset-0 z-[150] grid place-items-center bg-[#2F1E1A]/45 p-4 backdrop-blur-sm" onClick={onCancel}>
        <div className="w-full max-w-lg rounded-[2rem] border border-[#F4C7C4] bg-white p-5 shadow-[0_24px_80px_rgba(91,52,44,0.28)]" onClick={(event) => event.stopPropagation()}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#EA7188]">Thanh toán</p>
              <h3 className="mt-1 text-2xl font-black text-[#5B342C]">Bạn có chắc muốn thanh toán?</h3>
            </div>
            <button type="button" className="grid h-10 w-10 place-items-center rounded-2xl border border-[#F4C7C4] bg-white text-[#5B342C]" onClick={onCancel} disabled={loading}>
              <X size={18} />
            </button>
          </div>
          <div className="mt-4 rounded-[1.5rem] bg-[#FFF3EC] p-4">
            <div className="flex items-center gap-3">
              <CustomerAvatar booking={booking} />
              <PackageThumb booking={booking} />
              <div className="min-w-0">
                <p className="whitespace-normal break-words text-base font-black text-[#5B342C]">{booking.customerName || "Khách hàng"}</p>
                <p className="mt-1 whitespace-normal break-words text-sm font-bold text-[#9B746B]">{booking.packageName || "Gói dịch vụ"}</p>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between rounded-2xl bg-white px-4 py-3">
              <span className="text-sm font-bold text-[#9B746B]">Tổng thanh toán</span>
              <span className="text-xl font-black text-[#EA7188]">{formatMoney(booking.price)}</span>
            </div>
          </div>
          <div className="mt-5 grid gap-2 sm:grid-cols-3">
            <Button variant="secondary" className="min-h-11" onClick={onCancel} disabled={loading}>
              Hủy
            </Button>
            <Button className="min-h-11" onClick={onPay} disabled={loading}>
              {loading ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
              Thanh toán
            </Button>
            <Button variant="accent" className="min-h-12 rounded-2xl bg-[#5B342C] text-white shadow-[0_16px_36px_rgba(91,52,44,0.22)] transition hover:-translate-y-0.5 hover:bg-[#3B221D]" onClick={onPayAndPrint} disabled={loading}>
              {loading ? <Loader2 size={16} className="animate-spin mr-2" /> : <Printer size={16} />}
              Thanh toán + In
            </Button>
          </div>
        </div>
      </div>
    </Portal>
  );
}

function OrderBadge({ value }: { value: number }) {
  return (
    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-[#F4C7C4] bg-[#FFF3EC] text-sm font-black text-[#5B342C]">
      {value}
    </span>
  );
}

function DetailBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.25rem] border border-[#F4C7C4] bg-[#FFFDFB] p-4">
      <p className="text-xs font-black uppercase tracking-[0.12em] text-[#9B746B]">{label}</p>
      <p className="mt-2 break-words text-sm font-black text-[#5B342C]">{value}</p>
    </div>
  );
}

function receiptEscape(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatReceiptDateTime(value: unknown) {
  const date = value ? new Date(String(value)) : new Date();
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(safeDate);
}

function printBookingInvoice(booking: BookingItem, targetWindow?: Window | null) {
  const invoiceCode = booking.invoiceCode || `meoxinh--`;
  const customerName = booking.invoiceCustomerName || booking.customerName || "Khách hàng";
  const packageName = booking.invoicePackageName || booking.invoiceItems?.[0]?.description || booking.packageName || "Gói dịch vụ";
  const categoryName = booking.invoiceCategoryName || booking.categoryName || booking.package?.category?.name || "STUDIO";
  const amountValue = booking.invoiceTotal ?? booking.invoiceItems?.[0]?.total ?? booking.price;
  const amount = formatMoney(amountValue);
  const invoiceTime = booking.invoiceIssueDate || new Date();

  const originalPrice = Number(booking.price || amountValue || 0);
  const finalPrice = Number(amountValue || 0);
  const discountAmount = Math.max(0, originalPrice - finalPrice);

  let discountLabel = "";
  let discountPercent = "";
  if (booking.note) {
    const match = /Giảm giá:\s*([^\n\r()]+)(?:\s*\((\d+%)\))?/.exec(booking.note);
    if (match) {
      discountLabel = match[1].trim();
      if (match[2]) {
        discountPercent = match[2];
      }
    }
  }

  if (!discountLabel && discountAmount > 0) {
    discountLabel = `${discountAmount.toLocaleString("vi-VN")} đ`;
  }

  const paymentQrUrl = buildPaymentQrUrl(amountValue, invoiceCode);
  const qrBlock = paymentQrUrl
    ? `<div class="sep"></div><div class="center qr"><img src="${receiptEscape(paymentQrUrl)}" alt="QR thanh toán" /><div class="small bold">Quét mã để thanh toán</div><div class="small">Số tiền: ${receiptEscape(amount)}</div></div>`
    : "";
  const html = `<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>Hóa đơn ${invoiceCode}</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; background: #fff7fb; color: #4b2a25; font-family: Arial, "Helvetica Neue", sans-serif; padding-top: 10px; }
    .receipt { width: 80mm; max-width: 310px; margin: 0 auto; padding: 10px 9px; font-size: 12px; line-height: 1.38; background: #fff; border: 1px solid #f6c6d4; }
    .center { text-align: center; }
    .bold { font-weight: 700; }
    .brand-box { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; padding: 8px; border-radius: 14px; background: #fff0f5; border: 1px solid #f5b8ca; } .logo { width: 34px; height: 34px; border-radius: 50%; background: #fff; object-fit: contain; border: 1px solid #f5b8ca; } .brand { font-size: 15px; font-weight: 900; letter-spacing: .9px; text-transform: uppercase; color: #e86b88; }
    .address { margin-top: 3px; font-size: 10.5px; line-height: 1.35; color: #7a5750; }
    .title { margin: 8px 0 6px; padding: 7px 0; border-radius: 12px; background: #e86b88; color: #fff; font-size: 14px; font-weight: 900; text-align: center; text-transform: uppercase; letter-spacing: .4px; }
    .sep { margin: 8px 0; border-top: 1px dashed #e9a8b8; }
    .solid { margin: 8px 0; border-top: 1px solid #f0b4c1; }
    .row { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; }
    .left { flex: 1; min-width: 0; overflow-wrap: anywhere; }
    .right { flex: 0 0 auto; text-align: right; white-space: nowrap; }
    .info { margin-top: 4px; }
    .label { flex: 0 0 86px; }
    .section { margin-top: 4px; font-weight: 800; text-transform: uppercase; }
    .item { margin-top: 5px; }
    .qty { padding-left: 12px; }
    .total { padding: 8px; border-radius: 12px; background: #fff0f5; font-size: 13px; color: #d94f73; }
    .status { text-align: center; font-weight: 900; color: #0f9f6e; }
    .thanks { margin-top: 8px; line-height: 1.45; }
    .small { font-size: 11px; }
    .qr { margin-top: 8px; padding: 8px; border-radius: 14px; background: #fff; border: 1px solid #cfcfcf; color: #222; } .qr img { width: 128px; height: 128px; object-fit: contain; margin: 2px auto 4px; display: block; }
    
    /* Toolbar styles */
    .toolbar { display: flex; justify-content: center; gap: 10px; margin: 0 auto 12px; max-width: 310px; width: 100%; padding: 0 4px; }
    .btn { flex: 1; padding: 10px 14px; font-size: 13px; font-weight: bold; border: none; border-radius: 20px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; box-shadow: 0 4px 12px rgba(232,107,136,0.15); transition: all 0.2s ease; font-family: inherit; }
    .btn-print { background: #e86b88; color: white; }
    .btn-print:active { transform: scale(0.96); background: #d94f73; }
    .btn-close { background: #f3f4f6; color: #4b5563; }
    .btn-close:active { transform: scale(0.96); background: #e5e7eb; }

    @page { margin: 0; }
    @media print {
      .no-print { display: none !important; }
      body { background: #fff; margin: 0; padding-top: 0; }
      body { color: #000; }
      .receipt { width: 100%; max-width: 80mm; margin: 0 auto; padding: 8px 6px; border-color: #000; border: none !important; box-shadow: none !important; }
      .brand-box, .total, .qr { background: #fff; border-color: #000; color: #000; }
      .brand, .address, .title, .status { color: #000; }
      .title { background: #fff; border: 1px solid #000; }
      .sep { border-top-color: #777; }
      .solid { border-top-color: #000; }
    }
  </style>
</head>
<body>
  <div class="no-print toolbar">
    <button class="btn btn-print" onclick="window.print()">🖨️ In Hóa Đơn</button>
    <button class="btn btn-close" onclick="window.close()">❌ Đóng</button>
  </div>
  <div class="receipt">
    <div class="brand-box">
      <img class="logo" src="/be-meo-studio-avatar.svg" alt="Mèoo Xinhh" />
      <div>
        <div class="brand">Mèoo Xinhh Studio</div>
        <div class="address">make & photo</div>
        <div class="address">☎ ${receiptEscape(STUDIO_PHONE)}</div>
        <div class="address">⌂ ${receiptEscape(STUDIO_ADDRESS)}</div>
      </div>
    </div>
    <div class="title">HÓA ĐƠN THANH TOÁN</div>
    <div class="info row"><span class="label">🧾 Mã HĐ</span><span class="left">: ${receiptEscape(invoiceCode)}</span></div>
    <div class="info row"><span class="label">👤 Khách</span><span class="left">: ${receiptEscape(customerName)}</span></div>
    <div class="info row"><span class="label">⏰ Giờ</span><span class="left">: ${formatReceiptDateTime(invoiceTime)}</span></div>
    <div class="sep"></div>
    <div class="section">📸 GÓI CHỤP</div>
    <div>[${receiptEscape(categoryName)}] ${receiptEscape(packageName)}</div>
    <div class="sep"></div>
    <div class="section">💰 CHI TIẾT</div>
    <div class="item">
      <div>${receiptEscape(packageName)}</div>
      <div class="row qty"><span>x1</span><span class="right">${receiptEscape(formatMoney(originalPrice))}</span></div>
    </div>
    <div class="solid"></div>
    ${discountAmount > 0 ? `
    <div class="row info" style="margin-bottom: 4px; font-size: 11px; color: #7a5750;">
      <span>Giá gốc</span>
      <span class="right">${receiptEscape(formatMoney(originalPrice))}</span>
    </div>
    <div class="row info" style="margin-bottom: 6px; font-weight: bold; color: #e86b88;">
      <span>🏷️ Giảm giá ${discountPercent ? `(${discountPercent})` : ""}</span>
      <span class="right">-${receiptEscape(discountLabel)}</span>
    </div>
    <div class="solid" style="margin: 4px 0;"></div>
    ` : ""}
    <div class="row bold total"><span>TỔNG THANH TOÁN</span><span class="right">${receiptEscape(formatMoney(finalPrice))}</span></div>
    <div class="sep"></div>
    <div class="status">ĐÃ THANH TOÁN ✔</div>
    ${qrBlock}
    <div class="sep"></div>
    <div class="center thanks">Cảm ơn quý khách ♥<br/><span class="bold">MÈOO XINHH STUDIO 🐾</span></div>
  </div>
  <script>
    window.onload = () => {
      try {
        window.print();
      } catch (e) {
        console.error("Auto print blocked:", e);
      }
    };
  </script>
</body>
</html>`;
  const popup = targetWindow ?? window.open("", "_blank", "width=900,height=1000");
  if (!popup) return;
  popup.document.write(html);
  popup.document.close();
}

function GroupPaymentConfirmModal({
  group,
  onCancel,
  onPay,
  onPayAndPrint,
  loading = false,
}: {
  group: { key: string; title?: string; rows: BookingItem[] } | null;
  onCancel: () => void;
  onPay: () => void;
  onPayAndPrint: () => void;
  loading?: boolean;
}) {
  if (!group) return null;
  const targetRows = group.rows.filter(row => row.status !== "COMPLETED" && row.status !== "CANCELLED");
  const totalAmount = targetRows.reduce((sum, row) => sum + Number(row.total ?? row.price ?? 0), 0);

  return (
    <Portal>
      <div className="fixed inset-0 z-[150] grid place-items-center bg-[#2F1E1A]/45 p-4 backdrop-blur-sm" onClick={onCancel}>
        <div className="w-full max-w-xl rounded-[2rem] border border-[#F4C7C4] bg-white p-5 shadow-[0_24px_80px_rgba(91,52,44,0.28)]" onClick={(event) => event.stopPropagation()}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#EA7188]">Thanh toán nhóm</p>
              <h3 className="mt-1 text-2xl font-black text-[#5B342C]">Xác nhận thanh toán cả nhóm?</h3>
              <p className="mt-1 text-sm font-semibold text-[#9B746B]">{group.title}</p>
            </div>
            <button type="button" className="grid h-10 w-10 place-items-center rounded-2xl border border-[#F4C7C4] bg-white text-[#5B342C]" onClick={onCancel} disabled={loading}>
              <X size={18} />
            </button>
          </div>
          
          <div className="mt-4 max-h-[320px] overflow-y-auto rounded-[1.5rem] bg-[#FFF3EC] p-4 space-y-2">
            <p className="text-xs font-black uppercase tracking-wide text-[#EA7188] mb-1">Danh sách thanh toán ({targetRows.length} khách)</p>
            {targetRows.map((row) => {
              const originalPrice = Number(row.price ?? 0);
              const finalPrice = Number(row.total ?? row.price ?? 0);
              const discount = originalPrice - finalPrice;
              return (
                <div key={row.id} className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2 shadow-sm">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-[#5B342C]">{row.customerName || "Khách hàng"}</p>
                    <p className="truncate text-xs font-bold text-[#9B746B]">{row.packageName || "Chưa chọn gói"}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-black text-[#EA7188]">{formatMoney(finalPrice)}</p>
                    {discount > 0 ? (
                      <p className="text-[10px] font-bold text-red-500 line-through">-{formatMoney(discount)}</p>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex items-center justify-between rounded-2xl bg-[#FFF0F4] px-4 py-3 border border-[#F4C7C4]">
            <span className="text-sm font-black text-[#5B342C]">TỔNG CỘNG ({targetRows.length} khách)</span>
            <span className="text-2xl font-black text-[#EA7188]">{formatMoney(totalAmount)}</span>
          </div>

          <div className="mt-5 grid gap-2 sm:grid-cols-3">
            <Button variant="secondary" className="min-h-11" onClick={onCancel} disabled={loading}>
              Hủy
            </Button>
            <Button className="min-h-11" onClick={onPay} disabled={loading}>
              {loading ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
              Thanh toán nhóm
            </Button>
            <Button variant="accent" className="min-h-12 rounded-2xl bg-[#5B342C] text-white shadow-[0_16px_36px_rgba(91,52,44,0.22)] transition hover:-translate-y-0.5 hover:bg-[#3B221D]" onClick={onPayAndPrint} disabled={loading}>
              {loading ? <Loader2 size={16} className="animate-spin mr-2" /> : <Printer size={16} />}
              Thanh toán + In
            </Button>
          </div>
        </div>
      </div>
    </Portal>
  );
}

function printBookingGroupInvoice(group: { key: string; title?: string; rows: BookingItem[] }, targetWindow?: Window | null) {
  const invoiceCode = `GROUP-${group.key.slice(0, 8).toUpperCase()}`;
  const groupTitle = group.title || "Nhóm khách hàng";
  const invoiceTime = new Date();

  const targetRows = group.rows.filter(row => row.status === "COMPLETED");
  const totalOriginalAmount = targetRows.reduce((sum, row) => sum + Number(row.price ?? 0), 0);
  const totalFinalAmount = targetRows.reduce((sum, row) => sum + Number(row.total ?? row.price ?? 0), 0);
  const totalDiscountAmount = Math.max(0, totalOriginalAmount - totalFinalAmount);

  const paymentQrUrl = buildPaymentQrUrl(totalFinalAmount, invoiceCode);
  const qrBlock = paymentQrUrl
    ? `<div class="sep"></div><div class="center qr"><img src="${receiptEscape(paymentQrUrl)}" alt="QR thanh toán" /><div class="small bold">Quét mã để thanh toán</div><div class="small">Số tiền: ${receiptEscape(formatMoney(totalFinalAmount))}</div></div>`
    : "";

  const rowsHtml = targetRows.map((row) => {
    const originalPrice = Number(row.price ?? 0);
    const finalPrice = Number(row.total ?? row.price ?? originalPrice);
    const discount = originalPrice - finalPrice;
    
    return `
    <div class="item" style="margin-bottom: 8px;">
      <div class="bold" style="font-size: 11.5px; color: #4b2a25;">👤 ${receiptEscape(row.customerName)}</div>
      <div class="small" style="color: #7a5750; padding-left: 12px; margin-top: 1px;">📸 Gói: ${receiptEscape(row.packageName || "Chưa có gói")}</div>
      <div class="row qty" style="padding-left: 12px; font-size: 11px;">
        <span>Đơn giá: ${receiptEscape(formatMoney(originalPrice))}</span>
        ${discount > 0 ? `<span style="color: #e86b88; font-weight: bold;">Giảm: -${receiptEscape(formatMoney(discount))}</span>` : ""}
        <span class="right bold">${receiptEscape(formatMoney(finalPrice))}</span>
      </div>
    </div>
    `;
  }).join('<div class="solid" style="margin: 4px 0; border-top-color: #f7d5dd;"></div>');

  const html = `<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>Hóa đơn ${invoiceCode}</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; background: #fff7fb; color: #4b2a25; font-family: Arial, "Helvetica Neue", sans-serif; padding-top: 10px; }
    .receipt { width: 80mm; max-width: 310px; margin: 0 auto; padding: 10px 9px; font-size: 12px; line-height: 1.38; background: #fff; border: 1px solid #f6c6d4; }
    .center { text-align: center; }
    .bold { font-weight: 700; }
    .brand-box { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; padding: 8px; border-radius: 14px; background: #fff0f5; border: 1px solid #f5b8ca; } .logo { width: 34px; height: 34px; border-radius: 50%; background: #fff; object-fit: contain; border: 1px solid #f5b8ca; } .brand { font-size: 15px; font-weight: 900; letter-spacing: .9px; text-transform: uppercase; color: #e86b88; }
    .address { margin-top: 3px; font-size: 10.5px; line-height: 1.35; color: #7a5750; }
    .title { margin: 8px 0 6px; padding: 7px 0; border-radius: 12px; background: #e86b88; color: #fff; font-size: 14px; font-weight: 900; text-align: center; text-transform: uppercase; letter-spacing: .4px; }
    .sep { margin: 8px 0; border-top: 1px dashed #e9a8b8; }
    .solid { margin: 8px 0; border-top: 1px solid #f0b4c1; }
    .row { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; }
    .left { flex: 1; min-width: 0; overflow-wrap: anywhere; }
    .right { flex: 0 0 auto; text-align: right; white-space: nowrap; }
    .info { margin-top: 4px; }
    .label { flex: 0 0 86px; }
    .section { margin-top: 4px; font-weight: 800; text-transform: uppercase; }
    .item { margin-top: 5px; }
    .qty { padding-left: 12px; }
    .total { padding: 8px; border-radius: 12px; background: #fff0f5; font-size: 13px; color: #d94f73; }
    .status { text-align: center; font-weight: 900; color: #0f9f6e; }
    .thanks { margin-top: 8px; line-height: 1.45; }
    .small { font-size: 11px; }
    .qr { margin-top: 8px; padding: 8px; border-radius: 14px; background: #fff; border: 1px solid #cfcfcf; color: #222; } .qr img { width: 128px; height: 128px; object-fit: contain; margin: 2px auto 4px; display: block; }
    
    /* Toolbar styles */
    .toolbar { display: flex; justify-content: center; gap: 10px; margin: 0 auto 12px; max-width: 310px; width: 100%; padding: 0 4px; }
    .btn { flex: 1; padding: 10px 14px; font-size: 13px; font-weight: bold; border: none; border-radius: 20px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; box-shadow: 0 4px 12px rgba(232,107,136,0.15); transition: all 0.2s ease; font-family: inherit; }
    .btn-print { background: #e86b88; color: white; }
    .btn-print:active { transform: scale(0.96); background: #d94f73; }
    .btn-close { background: #f3f4f6; color: #4b5563; }
    .btn-close:active { transform: scale(0.96); background: #e5e7eb; }

    @page { margin: 0; }
    @media print {
      .no-print { display: none !important; }
      body { background: #fff; margin: 0; padding-top: 0; }
      body { color: #000; }
      .receipt { width: 100%; max-width: 80mm; margin: 0 auto; padding: 8px 6px; border-color: #000; border: none !important; box-shadow: none !important; }
      .brand-box, .total, .qr { background: #fff; border-color: #000; color: #000; }
      .brand, .address, .title, .status { color: #000; }
      .title { background: #fff; border: 1px solid #000; }
      .sep { border-top-color: #777; }
      .solid { border-top-color: #000; }
    }
  </style>
</head>
<body>
  <div class="no-print toolbar">
    <button class="btn btn-print" onclick="window.print()">🖨️ In Hóa Đơn</button>
    <button class="btn btn-close" onclick="window.close()">❌ Đóng</button>
  </div>
  <div class="receipt">
    <div class="brand-box">
      <img class="logo" src="/be-meo-studio-avatar.svg" alt="Mèoo Xinhh" />
      <div>
        <div class="brand">Mèoo Xinhh Studio</div>
        <div class="address">make & photo</div>
        <div class="address">☎ ${receiptEscape(STUDIO_PHONE)}</div>
        <div class="address">⌂ ${receiptEscape(STUDIO_ADDRESS)}</div>
      </div>
    </div>
    <div class="title">HÓA ĐƠN NHÓM</div>
    <div class="info row"><span class="label">🧾 Mã HĐ</span><span class="left">: ${receiptEscape(invoiceCode)}</span></div>
    <div class="info row"><span class="label">👥 Nhóm</span><span class="left">: ${receiptEscape(groupTitle)}</span></div>
    <div class="info row"><span class="label">⏰ Giờ</span><span class="left">: ${formatReceiptDateTime(invoiceTime)}</span></div>
    <div class="sep"></div>
    <div class="section" style="margin-bottom: 6px;">📸 CHI TIẾT ĐOÀN KHÁCH</div>
    
    ${rowsHtml}
    
    <div class="sep"></div>
    <div class="section">💰 TỔNG CỘNG ĐOÀN</div>
    <div class="row info" style="margin-bottom: 4px; font-size: 11px; color: #7a5750;">
      <span>Giá gốc cả nhóm</span>
      <span class="right">${receiptEscape(formatMoney(totalOriginalAmount))}</span>
    </div>
    ${totalDiscountAmount > 0 ? `
    <div class="row info" style="margin-bottom: 6px; font-weight: bold; color: #e86b88;">
      <span>🏷️ Tổng giảm giá</span>
      <span class="right">-${receiptEscape(formatMoney(totalDiscountAmount))}</span>
    </div>
    ` : ""}
    <div class="solid" style="margin: 4px 0;"></div>
    <div class="row bold total"><span>TỔNG THANH TOÁN</span><span class="right">${receiptEscape(formatMoney(totalFinalAmount))}</span></div>
    <div class="sep"></div>
    <div class="status">ĐÃ THANH TOÁN ✔</div>
    ${qrBlock}
    <div class="sep"></div>
    <div class="center thanks">Cảm ơn quý khách ♥<br/><span class="bold">MÈOO XINHH STUDIO 🐾</span></div>
  </div>
  <script>
    window.onload = () => {
      try {
        window.print();
      } catch (e) {
        console.error("Auto print blocked:", e);
      }
    };
  </script>
</body>
</html>`;
  const popup = targetWindow ?? window.open("", "_blank", "width=900,height=1000");
  if (!popup) return;
  popup.document.write(html);
  popup.document.close();
}
