"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CalendarClock, CheckCircle2, ChevronDown, ChevronUp, CreditCard, Images, Loader2, Pencil, Plus, Printer, ReceiptText, Search, Trash2, Users, X } from "lucide-react";
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
import { buildStudioReceiptHtml, openReceiptPrintWindow, type StudioReceiptLine } from "@/app/utils/receipt-template";

type CustomerItem = { id: string; name: string; phone?: string | null; avatarUrl?: string | null };
type CustomerPage = { items: CustomerItem[] };
type SearchCustomerItem = {
  id: string;
  type: string;
  title: string;
  subtitle?: string | null;
  targetResource?: string;
};
type GroupBookingCustomerSnapshot = {
  id: string;
  customerName: string;
  customerImage?: string | null;
  packageName: string;
  packageImage?: string | null;
  packageImages?: string[];
  status: string;
  subtotal: number;
  extraFee: number;
  totalAmount: number;
  invoiceCode: string;
};
type GroupBookingSnapshot = {
  id: string;
  groupName: string;
  paymentInfo?: { invoiceCode?: string; paymentMethod?: string; paidAt?: string };
  subtotal: number;
  discount: number;
  extraFee: number;
  totalAmount: number;
  paymentMethod?: string;
  createdAt?: string;
  customers: GroupBookingCustomerSnapshot[];
};
type BookingApiData = BookingItem & { groupBooking?: GroupBookingSnapshot };

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

function cleanBookingNote(note?: string | null) {
  return String(note ?? "")
    .replace(/^GROUP_BOOKING:.+$/gm, "")
    .replace(/GROUP_BOOKING_DONE:[^\n|]+/g, "")
    .replace(/BOOKING_DONE:[^\n|]+/g, "")
    .replace(/RECEIPT:\{.*?\}(?=\s*\||\n|$)/g, "")
    .replace(/Loại booking:\s*Booking nhóm(?:\s*-\s*[^\n.]+)?\.?/gi, "")
    .replace(/Tự động cộng doanh thu khi booking nhóm hoàn tất\.?/gi, "")
    .replace(/Tự động cộng doanh thu khi booking hoàn tất\.?/gi, "")
    .replace(/\s*\|\s*/g, " · ")
    .replace(/^\s*·\s*|\s*·\s*$/g, "")
    .trim();
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
      }).then((res) => res.json() as Promise<ApiResult<BookingApiData>>);

      if (result.error) {
        printWindow?.close();
        return setMessage(result.error.message);
      }
      setCancelTarget(null);
      setPaymentTarget(null);
      setDetail(null);
      setMessage(status === "COMPLETED" ? "Đã thanh toán, lưu hóa đơn và chuyển vào Booking hoàn tất." : "Đã hủy booking.");
      if (status === "COMPLETED" && printAfter) {
        if (result.data?.groupBooking) {
          printGroupBookingInvoice(result.data.groupBooking, printWindow);
        } else {
          printBookingInvoice(result.data ?? row, printWindow);
        }
      }
      await loadData();
    } catch (err) {
      printWindow?.close();
      console.error("Change status error:", err);
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
  const paymentGroup = paymentTarget ? displayGroups.find((group) => group.key && group.key === bookingGroupKey(paymentTarget)) : null;
  const paymentGroupRows = paymentGroup?.rows ?? (paymentTarget ? [paymentTarget] : []);

  function renderBookingRow(row: BookingItem, index: number, total: number) {
    const isDiscounted = Number(row.total ?? row.price) < Number(row.price);
    const displayNote = cleanBookingNote(row.note);

    const theme = completedOnly 
      ? { 
          card: "border-orange-400 bg-gradient-to-br from-orange-50 via-white to-orange-100 shadow-[0_12px_34px_-12px_rgba(194,65,12,0.45)] ring-1 ring-orange-200/80", 
          badge: "bg-orange-600 border-orange-700 text-white",
          dot: "bg-orange-600",
          money: "text-orange-700"
        }
      : { 
          card: "border-[#F4C7C4] bg-white", 
          badge: "bg-[#FFF0F4] border-[#F4C7C4] text-[#C14F69]",
          dot: "bg-[#EA7188]",
          money: "text-[#EA7188]"
        };

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
        className={`relative mt-6 w-full cursor-pointer rounded-[1.75rem] border p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md active:scale-[0.99] ${theme.card}`}
      >
        <span className={`absolute -top-3 left-5 rounded-full border px-3 py-1 text-[11px] font-black shadow-sm ${theme.badge}`}>
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
                <div className={`h-1.5 w-1.5 shrink-0 rounded-full ${theme.dot}`} />
                <p className="truncate text-sm font-bold text-[#9B746B]">{row.packageName || "Chưa có gói"}</p>
              </div>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <p className={`text-base font-black ${theme.money}`}>{formatMoney(row.total ?? row.price)}</p>
            {isDiscounted ? <p className="text-[10px] font-bold text-emerald-600">Đã giảm giá</p> : null}
          </div>
        </div>

        <div className="mt-3 flex items-center gap-3 rounded-[1.25rem] bg-[#FFFDFB] p-3">
          <PackageThumb booking={row} />
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wide text-[#EA7188]">
              <Images size={13} /> Gói chụp
            </p>
            <p className="mt-1 line-clamp-2 text-sm font-bold leading-5 text-[#5B342C]">{row.packageName || "Chưa có gói"}</p>
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
                className={`overflow-hidden rounded-[1.75rem] border-2 shadow-[0_14px_40px_-10px_rgba(184,95,108,0.18)] transition ${selected ? "border-[#EA7188] shadow-[0_0_0_4px_rgba(234,113,136,0.13),0_14px_40px_-10px_rgba(184,95,108,0.22)]" : "border-[#F4C7C4]"}`}
              >
                {/* ── Group Header ── */}
                <div
                  role="button"
                  tabIndex={0}
                  className="cursor-pointer bg-gradient-to-br from-[#FFF8F1] via-[#FFF0F4] to-[#FFE4EA] px-4 pb-3 pt-4 transition active:scale-[0.995] sm:px-5"
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
                  <div className="flex items-start gap-3">
                    {showGroupCheckbox ? (
                      <button
                        type="button"
                        aria-pressed={selected}
                        aria-label={selected ? "Bỏ chọn nhóm" : "Chọn nhóm"}
                        onClick={(event) => {
                          event.stopPropagation();
                          toggleGroupSelection(group.key);
                        }}
                        className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl border-2 text-[12px] font-black transition ${selected ? "scale-105 border-[#EA7188] bg-[#EA7188] text-white shadow-[0_0_0_4px_rgba(234,113,136,0.18)]" : "border-[#F4C7C4] bg-white text-[#EA7188]"}`}
                      >
                        {selected ? "✓" : ""}
                      </button>
                    ) : (
                      <div className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-[#EA7188] to-[#D94F73] shadow-[0_6px_18px_rgba(234,113,136,0.35)]">
                        <Users size={18} className="text-white" strokeWidth={2.5} />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#EA7188]/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-[#D94F73]">Nhóm</span>
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white text-[11px] font-black text-[#EA7188] shadow-sm ring-1 ring-[#F4C7C4]">{group.rows.length}</span>
                      </div>
                      <h2 className="mt-1.5 line-clamp-2 text-[1.1rem] font-black leading-6 text-[#5B342C]">{group.title}</h2>
                      <p className="mt-1 text-[13px] font-semibold leading-5 text-[#9B746B]">
                        {group.rows.length} khách · {packageNames.length <= 1 ? (packageNames[0] ?? "Chưa có gói") : `${packageNames.length} gói khác nhau`}
                      </p>
                    </div>
                    {/* Expand/collapse toggle */}
                    <div className={`mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-xl transition ${expanded ? "bg-[#EA7188] text-white shadow-sm" : "bg-white text-[#9B746B] ring-1 ring-[#F4C7C4]"}`}>
                      {expanded ? <ChevronUp size={16} strokeWidth={2.5} /> : <ChevronDown size={16} strokeWidth={2.5} />}
                    </div>
                  </div>

                  {/* ── Action buttons ── */}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {!completedOnly ? (
                      <button
                        type="button"
                        className="inline-flex min-h-[2.25rem] flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-[13px] font-black text-white shadow-[0_8px_20px_rgba(5,150,105,0.22)] transition hover:bg-emerald-700 active:scale-[0.97]"
                        onClick={(event) => {
                          event.stopPropagation();
                          setPaymentTarget(group.rows[0]);
                        }}
                      >
                        <CreditCard size={15} strokeWidth={2.5} /> Thanh toán
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="inline-flex min-h-[2.25rem] items-center justify-center gap-1.5 rounded-xl border-2 border-[#F4C7C4] bg-white px-3 py-2 text-[13px] font-black text-[#A84E61] shadow-sm transition hover:bg-[#FFF0F4] active:scale-[0.97]"
                      onClick={(event) => {
                        event.stopPropagation();
                        void renameGroup(group);
                      }}
                    >
                      <Pencil size={13} strokeWidth={2.5} /> Sửa tên
                    </button>
                  </div>
                </div>

                {/* ── Expanded children ── */}
                {expanded ? (
                  <div className="grid gap-2 bg-white/80 p-3">
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
        groupRows={paymentGroupRows}
        groupName={paymentGroup?.title ?? bookingGroupName(paymentTarget?.note)}
        onCancel={() => setPaymentTarget(null)}
        onPay={() => paymentTarget ? void changeStatus(paymentTarget, "COMPLETED") : undefined}
        onPrintEstimate={() => {
          if (!paymentTarget) return;
          if (paymentGroupRows.length > 1) {
            printGroupEstimateInvoice(paymentGroup?.title ?? bookingGroupName(paymentTarget.note) ?? "Booking nhóm", paymentGroupRows);
            return;
          }
          printPersonalEstimateInvoice(paymentTarget);
        }}
        onPayAndPrint={() => {
          if (!paymentTarget) return;
          const printWindow = window.open("", "_blank", "width=900,height=1000");
          void changeStatus(paymentTarget, "COMPLETED", true, printWindow);
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

function CustomerAvatar({ booking, large = false, compact = false }: { booking: BookingItem; large?: boolean; compact?: boolean }) {
  const image = booking.customer?.avatarUrl || booking.imageUrl;
  const size = large ? "h-14 w-14 rounded-2xl" : compact ? "h-10 w-10 rounded-xl" : "h-12 w-12 rounded-2xl";

  if (image) {
    return (
      <div className={`${size} shrink-0 overflow-hidden border border-[#F4C7C4] bg-[#FFF3EC] shadow-sm`}>
        <img src={image} alt={booking.customerName || "Khách"} className="h-full w-full object-cover" />
      </div>
    );
  }

  return (
    <div className={`grid ${size} shrink-0 place-items-center bg-[#FFF3EC] text-[#5B342C]`}>
      <CalendarClock size={large ? 24 : compact ? 18 : 22} />
    </div>
  );
}

function PackageThumb({ booking, compact = false }: { booking: BookingItem; compact?: boolean }) {
  const image = booking.package?.imageUrl;
  const size = compact ? "h-10 w-10 rounded-xl" : "h-14 w-14 rounded-2xl";
  if (!image) {
    return (
      <div className={`grid ${size} shrink-0 place-items-center border border-[#F4C7C4] bg-[#FFF3EC] text-[#A84E61] shadow-sm`}>
        <Images size={compact ? 17 : 20} />
      </div>
    );
  }
  return (
    <div className={`relative ${size} shrink-0 overflow-hidden border border-[#F4C7C4] bg-[#FFF3EC] shadow-sm`}>
      <img src={image} alt={booking.packageName || "Gói"} className="h-full w-full object-cover" />
      <span className={`absolute bottom-0 left-0 right-0 bg-white/92 px-1 py-0.5 text-center font-black text-[#A84E61] shadow-sm ${compact ? "text-[7px]" : "text-[9px]"}`}>
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
      <div className="fixed inset-0 z-[150] grid place-items-center bg-[#2F1E1A]/45 p-2 backdrop-blur-sm sm:p-4" onClick={onCancel}>
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
  groupRows = [],
  groupName,
  onCancel,
  onPay,
  onPrintEstimate,
  onPayAndPrint,
  loading = false,
}: {
  booking: BookingItem | null;
  groupRows?: BookingItem[];
  groupName?: string | null;
  onCancel: () => void;
  onPay: () => void;
  onPrintEstimate?: () => void;
  onPayAndPrint: () => void;
  loading?: boolean;
}) {
  if (!booking) return null;
  const isGroup = groupRows.length > 1;
  const totalAmount = isGroup
    ? groupRows.reduce((sum, row) => sum + moneyNumber(row.total ?? row.price), 0)
    : moneyNumber(booking.total ?? booking.price);
  const resolvedGroupName = groupName || "Booking nhóm";
  return (
    <Portal>
      <div className="fixed inset-0 z-[150] grid place-items-center bg-[#2F1E1A]/45 p-4 backdrop-blur-sm" onClick={onCancel}>
        <div className="flex max-h-[calc(100dvh-1rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] w-full max-w-lg flex-col overflow-hidden rounded-[1.5rem] border border-[#F4C7C4] bg-white p-4 shadow-[0_24px_80px_rgba(91,52,44,0.28)] sm:rounded-[2rem] sm:p-5" onClick={(event) => event.stopPropagation()}>
          <div className="flex shrink-0 items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#EA7188]">Thanh toán</p>
              <h3 className="mt-1 break-words text-xl font-black leading-tight text-[#5B342C] sm:text-2xl">Bạn có chắc muốn thanh toán?</h3>
            </div>
            <button type="button" className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-[#F4C7C4] bg-white text-[#5B342C]" onClick={onCancel} disabled={loading}>
              <X size={18} />
            </button>
          </div>
          <div className="studio-ios-scroll mt-3 min-h-0 flex-1 overflow-y-auto rounded-[1.25rem] bg-[#FFF3EC] p-3 sm:mt-4 sm:rounded-[1.5rem] sm:p-4">
            <div className="flex items-center gap-2.5">
              <CustomerAvatar booking={booking} compact />
              <PackageThumb booking={booking} compact />
              <div className="min-w-0">
                <p className="whitespace-normal break-words text-base font-black text-[#5B342C]">{booking.customerName || "Khách hàng"}</p>
                <p className="mt-1 whitespace-normal break-words text-sm font-bold text-[#9B746B]">{booking.packageName || "Gói dịch vụ"}</p>
              </div>
            </div>
            {isGroup ? (
              <p className="mt-3 rounded-2xl bg-white px-3 py-2 text-sm font-black text-[#5B342C]">
                {resolvedGroupName}
              </p>
            ) : null}
            {isGroup ? (
              <div className="studio-ios-scroll mt-3 grid max-h-[30dvh] gap-2 overflow-y-auto pr-1 sm:max-h-52">
                {groupRows.map((row) => (
                  <div key={row.id} className="grid grid-cols-[36px_minmax(0,1fr)] items-center gap-2 rounded-2xl bg-white px-3 py-2 sm:grid-cols-[40px_minmax(0,1fr)_auto]">
                    <CustomerAvatar booking={row} compact />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-black text-[#5B342C]">{row.customerName || "Khách hàng"}</p>
                      <p className="truncate text-xs font-bold text-[#9B746B]">{row.packageName || "Gói dịch vụ"}</p>
                    </div>
                    <p className="col-start-2 break-words text-sm font-black text-[#EA7188] sm:col-start-auto sm:whitespace-nowrap">{formatMoney(row.total ?? row.price)}</p>
                  </div>
                ))}
              </div>
            ) : null}
            <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 sm:mt-4">
              <span className="text-sm font-bold text-[#9B746B]">Tổng thanh toán</span>
              <span className="break-words text-right text-lg font-black text-[#EA7188] sm:text-xl">{formatMoney(totalAmount)}</span>
            </div>
          </div>
          <div className="mt-3 grid shrink-0 gap-2 sm:mt-5 sm:grid-cols-4">
            <Button variant="secondary" className="min-h-11" onClick={onCancel} disabled={loading}>
              Hủy
            </Button>
            <Button variant="secondary" className="min-h-11" onClick={onPrintEstimate} disabled={loading}>
              <ReceiptText size={16} /> In tạm tính
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

function bookingDiscountText(originalAmount: unknown, finalAmount: unknown) {
  const discount = Math.max(0, moneyNumber(originalAmount) - moneyNumber(finalAmount));
  return discount > 0 ? `Giảm ${formatMoney(discount)}` : undefined;
}

function personalReceiptLines(booking: BookingItem): StudioReceiptLine[] {
  const originalPrice = moneyNumber(booking.price);
  const finalPrice = moneyNumber(booking.invoiceTotal ?? booking.invoiceItems?.[0]?.total ?? booking.total ?? booking.price);
  const packageName = booking.invoicePackageName || booking.invoiceItems?.[0]?.description || booking.packageName || "Gói dịch vụ";
  return [{
    name: packageName,
    description: booking.invoiceCategoryName || booking.categoryName || booking.package?.category?.name || "STUDIO",
    quantity: "x1",
    amount: finalPrice,
    originalAmount: originalPrice,
    discountText: bookingDiscountText(originalPrice, finalPrice),
  }];
}

function printPersonalEstimateInvoice(booking: BookingItem) {
  const total = moneyNumber(booking.total ?? booking.price);
  const code = `TT-${booking.id.slice(-6).toUpperCase()}`;
  openReceiptPrintWindow(buildStudioReceiptHtml({
    title: "BILL TẠM TÍNH",
    code,
    customer: booking.customerName || "Khách hàng",
    time: formatReceiptDateTime(new Date()),
    packageTitle: booking.packageName || "Gói dịch vụ",
    packageSubtitle: booking.categoryName || booking.package?.category?.name || "STUDIO",
    lines: personalReceiptLines(booking),
    total,
    totalLabel: "TỔNG TẠM TÍNH",
    statusText: "TẠM TÍNH",
    qrUrl: buildPaymentQrUrl(total, code),
    qrAmountLabel: `Số tiền: ${formatMoney(total)}`,
    printButtonLabel: "In tạm tính",
  }));
}

function printGroupEstimateInvoice(groupName: string, rows: BookingItem[]) {
  {
  const total = rows.reduce((sum, row) => sum + moneyNumber(row.total ?? row.price), 0);
  const code = `TT-${groupName.replace(/\s+/g, "").slice(0, 10) || "GROUP"}`;
  openReceiptPrintWindow(buildStudioReceiptHtml({
    title: "BILL TẠM TÍNH",
    code,
    customer: groupName,
    time: formatReceiptDateTime(new Date()),
    packageTitle: `Booking nhóm - ${groupName}`,
    lines: rows.map((row) => {
      const original = moneyNumber(row.price);
      const finalAmount = moneyNumber(row.total ?? row.price);
      return {
        name: row.customerName || "Khách hàng",
        description: row.packageName || "Gói dịch vụ",
        quantity: "x1",
        amount: finalAmount,
        originalAmount: original,
        discountText: bookingDiscountText(original, finalAmount),
      };
    }),
    total,
    totalLabel: "TỔNG TẠM TÍNH",
    statusText: "TẠM TÍNH",
    qrUrl: buildPaymentQrUrl(total, code),
    qrAmountLabel: `Số tiền: ${formatMoney(total)}`,
    printButtonLabel: "In tạm tính",
  }));
    return;
  }
  const total = rows.reduce((sum, row) => sum + moneyNumber(row.total ?? row.price), 0);
  const items = rows.map((row, index) => {
    const orig = moneyNumber(row.price);
    const final_ = moneyNumber(row.total ?? row.price);
    const disc = final_ < orig;
    return `<div class="item"><div>${index + 1}. ${receiptEscape(row.customerName || "Khách hàng")}</div><div class="small muted">${receiptEscape(row.packageName || "Gói dịch vụ")}</div><div class="row qty"><span>x1</span><span class="right">${disc ? `<span style="text-decoration:line-through;color:#7a5750;font-size:11px">${receiptEscape(formatMoney(orig))}</span> ` : ""}${receiptEscape(formatMoney(final_))}</span></div>${disc ? `<div class="small" style="color:#e86b88;padding-left:12px">🏷️ Giảm ${receiptEscape(formatMoney(orig - final_))}</div>` : ""}</div>`;
  }).join("");
  const html = `<!doctype html><html lang="vi"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/><title>Bill tạm tính</title><style>
    *{box-sizing:border-box}body{margin:0;background:#fff7fb;color:#4b2a25;font-family:Arial,"Helvetica Neue",sans-serif;padding-top:10px}.receipt{width:80mm;max-width:310px;margin:0 auto;padding:10px 9px;font-size:12px;line-height:1.38;background:#fff;border:1px solid #f6c6d4}.center{text-align:center}.bold{font-weight:700}.muted{color:#7a5750}.brand-box{display:flex;align-items:center;gap:8px;margin-bottom:8px;padding:8px;border-radius:14px;background:#fff0f5;border:1px solid #f5b8ca}.logo{width:34px;height:34px;border-radius:50%;background:#fff;object-fit:contain;border:1px solid #f5b8ca}.brand{font-size:15px;font-weight:900;letter-spacing:.9px;text-transform:uppercase;color:#e86b88}.address{margin-top:3px;font-size:10.5px;line-height:1.35;color:#7a5750}.title{margin:8px 0 6px;padding:7px 0;border-radius:12px;background:#e86b88;color:#fff;font-size:14px;font-weight:900;text-align:center;text-transform:uppercase;letter-spacing:.4px}.sep{margin:8px 0;border-top:1px dashed #e9a8b8}.solid{margin:8px 0;border-top:1px solid #f0b4c1}.row{display:flex;justify-content:space-between;align-items:flex-start;gap:8px}.left{flex:1;min-width:0;overflow-wrap:anywhere}.right{flex:0 0 auto;text-align:right;white-space:nowrap}.info{margin-top:4px}.label{flex:0 0 86px}.section{margin-top:4px;font-weight:800;text-transform:uppercase}.item{margin-top:5px}.qty{padding-left:12px}.small{font-size:11px}.total{padding:8px;border-radius:12px;background:#fff0f5;font-size:13px;color:#d94f73}.toolbar{display:flex;justify-content:center;gap:10px;margin:0 auto 12px;max-width:310px;width:100%;padding:0 4px}.btn{flex:1;padding:10px 14px;font-size:13px;font-weight:bold;border:0;border-radius:20px;cursor:pointer}.btn-print{background:#e86b88;color:white}.btn-close{background:#f3f4f6;color:#4b5563}@page{margin:0}@media print{.no-print{display:none!important}body{background:#fff;margin:0;padding-top:0;color:#000}.receipt{width:100%;max-width:80mm;margin:0 auto;padding:8px 6px;border:0!important}.brand-box,.total{background:#fff;border-color:#000;color:#000}.brand,.address,.title{color:#000}.title{background:#fff;border:1px solid #000}.sep{border-top-color:#777}.solid{border-top-color:#000}}
  </style></head><body><div class="no-print toolbar"><button class="btn btn-print" onclick="window.print()">In tạm tính</button><button class="btn btn-close" onclick="window.close()">Đóng</button></div><div class="receipt"><div class="brand-box"><img class="logo" src="/be-meo-studio-avatar.svg" alt="Mèoo Xinhh"/><div><div class="brand">Mèoo Xinhh Studio</div><div class="address">make & photo</div><div class="address">☎ ${receiptEscape(STUDIO_PHONE)}</div><div class="address">⌂ ${receiptEscape(STUDIO_ADDRESS)}</div></div></div><div class="title">BILL TẠM TÍNH</div><div class="info row"><span class="label">Nhóm</span><span class="left">: ${receiptEscape(groupName)}</span></div><div class="info row"><span class="label">Giờ</span><span class="left">: ${receiptEscape(formatReceiptDateTime(new Date()))}</span></div><div class="sep"></div><div class="section">GÓI CHỤP</div><div>Booking nhóm - ${receiptEscape(groupName)}</div><div class="sep"></div><div class="section">CHI TIẾT</div>${items}<div class="solid"></div><div class="row bold total"><span>TỔNG TẠM TÍNH</span><span class="right">${receiptEscape(formatMoney(total))}</span></div><div class="sep"></div><div class="center qr"><img src="${receiptEscape(buildPaymentQrUrl(total, `TT-${groupName.replace(/\\s+/g, "").slice(0, 10)}`))}" alt="QR" style="width:128px;height:128px;object-fit:contain;margin:4px auto;display:block"/><div class="small bold">Quét mã để thanh toán</div></div><div class="sep"></div><div class="center thanks">Cảm ơn quý khách ♥<br/><span class="bold">MÈOO XINHH STUDIO</span></div></div><script>window.onload=()=>{try{window.print();}catch(e){console.error(e);}};</script></body></html>`;
  const popup = window.open("", "_blank", "width=900,height=1000");
  if (!popup) return;
  popup!.document.write(html);
  popup!.document.close();
}

function printGroupBookingInvoice(groupBooking: GroupBookingSnapshot, targetWindow?: Window | null) {
  {
    const invoiceCode = groupBooking.paymentInfo?.invoiceCode || groupBooking.customers[0]?.invoiceCode || "Group-meoxinh--";
    const paidAt = groupBooking.paymentInfo?.paidAt || groupBooking.createdAt || new Date();
    openReceiptPrintWindow(buildStudioReceiptHtml({
      title: "HÓA ĐƠN THANH TOÁN",
      code: invoiceCode,
      customer: groupBooking.groupName,
      time: formatReceiptDateTime(paidAt),
      packageTitle: `Booking nhóm - ${groupBooking.groupName}`,
      lines: groupBooking.customers.map((customer) => {
        const original = moneyNumber(customer.subtotal ?? customer.totalAmount);
        const finalAmount = moneyNumber(customer.totalAmount);
        return {
          name: customer.customerName,
          description: customer.packageName,
          amount: finalAmount,
          originalAmount: original,
          discountText: bookingDiscountText(original, finalAmount),
        };
      }),
      subtotal: groupBooking.subtotal,
      discount: groupBooking.discount,
      extraFee: groupBooking.extraFee,
      total: groupBooking.totalAmount,
      statusText: "ĐÃ THANH TOÁN ✓",
      qrUrl: buildPaymentQrUrl(groupBooking.totalAmount, invoiceCode),
      qrAmountLabel: `Số tiền: ${formatMoney(groupBooking.totalAmount)}`,
      printButtonLabel: "In hóa đơn",
    }), targetWindow);
    return;
  }
  const invoiceCode = groupBooking.paymentInfo?.invoiceCode || groupBooking.customers[0]?.invoiceCode || "Group-meoxinh--";
  const paidAt = groupBooking.paymentInfo?.paidAt || groupBooking.createdAt || new Date();
  const rows = groupBooking.customers.map((customer, index) => {
    const sub = Number(customer.subtotal ?? customer.totalAmount);
    const fin = Number(customer.totalAmount);
    const disc = fin < sub;
    return `<div class="item"><div class="row"><span class="left">${index + 1}. ${receiptEscape(customer.customerName)}</span><span class="right">${disc ? `<span style="text-decoration:line-through;color:#7a5750;font-size:11px">${receiptEscape(formatMoney(sub))}</span> ` : ""}${receiptEscape(formatMoney(fin))}</span></div><div class="small muted">${receiptEscape(customer.packageName)}</div>${disc ? `<div class="small" style="color:#e86b88">🏷️ Giảm ${receiptEscape(formatMoney(sub - fin))}</div>` : ""}</div>`;
  }).join("");
  const html = `<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>Hóa đơn ${receiptEscape(invoiceCode)}</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; background: #fff7fb; color: #4b2a25; font-family: Arial, "Helvetica Neue", sans-serif; padding-top: 10px; }
    .receipt { width: 80mm; max-width: 310px; margin: 0 auto; padding: 10px 9px; font-size: 12px; line-height: 1.38; background: #fff; border: 1px solid #f6c6d4; }
    .center { text-align: center; }
    .bold { font-weight: 700; }
    .muted { color: #7a5750; }
    .brand-box { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; padding: 8px; border-radius: 14px; background: #fff0f5; border: 1px solid #f5b8ca; }
    .logo { width: 34px; height: 34px; border-radius: 50%; background: #fff; object-fit: contain; border: 1px solid #f5b8ca; }
    .brand { font-size: 15px; font-weight: 900; letter-spacing: .9px; text-transform: uppercase; color: #e86b88; }
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
    .small { font-size: 11px; }
    .total { padding: 8px; border-radius: 12px; background: #fff0f5; font-size: 13px; color: #d94f73; }
    .status { text-align: center; font-weight: 900; color: #0f9f6e; }
    .thanks { margin-top: 8px; line-height: 1.45; }
    .toolbar { display: flex; justify-content: center; gap: 10px; margin: 0 auto 12px; max-width: 310px; width: 100%; padding: 0 4px; }
    .btn { flex: 1; padding: 10px 14px; font-size: 13px; font-weight: bold; border: none; border-radius: 20px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; box-shadow: 0 4px 12px rgba(232,107,136,0.15); transition: all 0.2s ease; font-family: inherit; }
    .btn-print { background: #e86b88; color: white; }
    .btn-close { background: #f3f4f6; color: #4b5563; }
    @page { margin: 0; }
    @media print {
      .no-print { display: none !important; }
      body { background: #fff; margin: 0; padding-top: 0; color: #000; }
      .receipt { width: 100%; max-width: 80mm; margin: 0 auto; padding: 8px 6px; border: none !important; box-shadow: none !important; }
      .brand-box, .total { background: #fff; border-color: #000; color: #000; }
      .brand, .address, .title, .status { color: #000; }
      .title { background: #fff; border: 1px solid #000; }
      .sep { border-top-color: #777; }
      .solid { border-top-color: #000; }
    }
  </style>
</head>
<body>
  <div class="no-print toolbar">
    <button class="btn btn-print" onclick="window.print()">In hóa đơn</button>
    <button class="btn btn-close" onclick="window.close()">Đóng</button>
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
    <div class="info row"><span class="label">Mã HĐ</span><span class="left">: ${receiptEscape(invoiceCode)}</span></div>
    <div class="info row"><span class="label">Khách</span><span class="left">: ${receiptEscape(groupBooking.groupName)}</span></div>
    <div class="info row"><span class="label">Giờ</span><span class="left">: ${receiptEscape(formatReceiptDateTime(paidAt))}</span></div>
    <div class="sep"></div>
    <div class="section">GÓI CHỤP</div>
    <div>Booking nhóm - ${receiptEscape(groupBooking.groupName)}</div>
    <div class="sep"></div>
    <div class="section">CHI TIẾT</div>
    ${rows}
    <div class="solid"></div>
    ${groupBooking.extraFee > 0 ? `<div class="row info"><span>Phí phát sinh</span><span class="right">${receiptEscape(formatMoney(groupBooking.extraFee))}</span></div>` : ""}
    <div class="row bold total"><span>TỔNG THANH TOÁN</span><span class="right">${receiptEscape(formatMoney(groupBooking.totalAmount))}</span></div>
    <div class="sep"></div>
    <div class="status">ĐÃ THANH TOÁN ✓</div>
    <div class="sep"></div>
    <div class="center qr"><img src="${receiptEscape(buildPaymentQrUrl(groupBooking.totalAmount, invoiceCode))}" alt="QR" style="width:128px;height:128px;object-fit:contain;margin:4px auto;display:block"/><div class="small bold">Quét mã để thanh toán</div></div>
    <div class="sep"></div>
    <div class="center thanks">Cảm ơn quý khách ♥<br/><span class="bold">MÈOO XINHH STUDIO</span></div>
  </div>
  <script>window.onload=()=>{try{window.print();}catch(e){console.error(e);}};</script>
</body>
</html>`;
  const popup = targetWindow ?? window.open("", "_blank", "width=900,height=1000");
  if (!popup) return;
  popup!.document.write(html);
  popup!.document.close();
}

function printBookingInvoice(booking: BookingItem, targetWindow?: Window | null) {
  {
    const invoiceCode = booking.invoiceCode || `meoxinh--`;
    const total = moneyNumber(booking.invoiceTotal ?? booking.invoiceItems?.[0]?.total ?? booking.total ?? booking.price);
    openReceiptPrintWindow(buildStudioReceiptHtml({
      title: "HÓA ĐƠN THANH TOÁN",
      code: invoiceCode,
      customer: booking.invoiceCustomerName || booking.customerName || "Khách hàng",
      time: formatReceiptDateTime(booking.invoiceIssueDate || new Date()),
      packageTitle: booking.invoicePackageName || booking.invoiceItems?.[0]?.description || booking.packageName || "Gói dịch vụ",
      packageSubtitle: booking.invoiceCategoryName || booking.categoryName || booking.package?.category?.name || "STUDIO",
      lines: personalReceiptLines(booking),
      total,
      statusText: "ĐÃ THANH TOÁN ✓",
      qrUrl: buildPaymentQrUrl(total, invoiceCode),
      qrAmountLabel: `Số tiền: ${formatMoney(total)}`,
      printButtonLabel: "In hóa đơn",
    }), targetWindow);
    return;
  }
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
  const legacyNote = String(booking.note ?? "");
  if (legacyNote) {
    const match = /Giảm giá:\s*([^\n\r()]+)(?:\s*\((\d+%)\))?/.exec(legacyNote);
    discountLabel = match?.[1]?.trim() ?? "";
    discountPercent = match?.[2] ?? "";
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
  popup!.document.write(html);
  popup!.document.close();
}
