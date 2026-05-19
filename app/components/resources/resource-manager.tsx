"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { memo, type ReactNode, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, startTransition } from "react";
import dynamic from "next/dynamic";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  CalendarClock,
  CreditCard,
  ImageIcon,
  Loader2,
  PawPrint,
  Pencil,
  Printer,
  Repeat2,
  Save,
  Search,
  Trash2,
  TrendingUp,
  WalletCards,
  X,
} from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { DetailModal } from "@/app/components/ui/detail-modal";
import { Card, CardTitle } from "@/app/components/ui/card";
import { DateTimeInput, Input, Textarea } from "@/app/components/ui/input";
import { Portal } from "@/app/components/ui/portal";
const MediaGalleryPicker = dynamic(() => import("@/app/components/media/media-picker").then((m) => m.MediaGalleryPicker), { ssr: false });
const MediaPicker = dynamic(() => import("@/app/components/media/media-picker").then((m) => m.MediaPicker), { ssr: false });
import { ImagePreview } from "@/app/components/media/image-preview";
import { AlertModal } from "@/app/components/ui/alert-modal";
const BookingCalendar = dynamic(() => import("@/app/components/bookings/booking-calendar").then((m) => m.BookingCalendar), { ssr: false });
import { StudioBrandPanel } from "@/app/components/brand/studio-brand";
import { PageSpinner } from "@/app/components/ui/skeleton";
import { RESOURCE_CONFIG, type FieldConfig, type ResourceConfig, type ResourceKey } from "@/app/lib/studio-config";
import { canCreate, canDelete, canMutate } from "@/app/types/auth";
import { viOption } from "@/app/lib/vietnamese-labels";
import { formatDate, formatMoney } from "@/app/utils/format";
import { cn } from "@/app/utils/cn";
import { useUiStore } from "@/app/store/ui-store";
import { navigateStudioView } from "@/app/utils/studio-navigation";
import { useProgressiveList, ProgressiveListSentinel } from "@/app/components/ui/progressive-list";
import { buildStudioReceiptHtml, openReceiptPrintWindow } from "@/app/utils/receipt-template";

type Row = Record<string, unknown>;
type TransactionView = "income" | "expense" | null;
type PaginatedRows = {
  items: Row[];
  nextCursor: string | null;
  hasMore: boolean;
};
type ShiftData = {
  openShift: Row | null;
  shifts: Row[];
  nextCode?: string;
};
type GroupBookingCustomerSnapshot = {
  id: string;
  customerName: string;
  customerImage?: string | null;
  packageName: string;
  packageImage?: string | null;
  packageImages?: string[];
  status?: string;
  subtotal?: number;
  extraFee?: number;
  totalAmount: number;
  invoiceCode: string;
};
type GroupBookingSnapshot = {
  id: string;
  groupName: string;
  paymentInfo?: { invoiceCode?: string; paymentMethod?: string; paidAt?: string; walletName?: string | null };
  subtotal: number;
  discount: number;
  extraFee: number;
  totalAmount: number;
  paymentMethod?: string;
  createdAt?: string;
  customers: GroupBookingCustomerSnapshot[];
};

const fallbackImages = [
  "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=240&q=80",
  "https://images.unsplash.com/photo-1529634806980-85c3dd6d34ac?auto=format&fit=crop&w=240&q=80",
  "https://images.unsplash.com/photo-1511285560929-80b456fea0bc?auto=format&fit=crop&w=240&q=80",
];
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

function defaultValue(field: FieldConfig): string {
  if (field.type === "number") return "0";
  if (field.type === "boolean") return "false";
  if (field.type === "gallery") return "[]";
  return "";
}

function emptyForm(fields: FieldConfig[]) {
  return fields.reduce<Record<string, unknown>>((acc, field) => {
    acc[field.key] = defaultValue(field);
    return acc;
  }, {});
}

function FieldInput({ field, value, onChange }: { field: FieldConfig; value: unknown; onChange: (value: string) => void }) {
  const inputValue = typeof value === "string" || typeof value === "number" ? value : "";
  if (field.type === "gallery") return null;
  if (field.type === "image") return <MediaPicker value={String(inputValue ?? "")} placeholder={field.placeholder} onChange={onChange} />;
  if (field.type === "textarea") return <Textarea placeholder={field.placeholder} value={inputValue} onChange={(event) => onChange(event.target.value)} />;
  if (field.type === "select" || field.type === "boolean") {
    return (
      <select
        className="h-12 w-full rounded-2xl border border-[#F1C5C1] bg-[#FFF9F4] px-4 text-sm font-semibold text-[#5B342C] outline-none transition focus:border-[#EA7188] focus:ring-2 focus:ring-[#FFD4DF]"
        value={String(value ?? "")}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Chọn giá trị</option>
        {field.options?.map((option) => (
          <option key={option} value={option}>
            {viOption(option)}
          </option>
        ))}
      </select>
    );
  }
  if (field.type === "datetime" || field.type === "date") {
    // Chuyển đổi từ ISO (UTC) sang định dạng local YYYY-MM-DDTHH:mm cho input
    let localValue = String(inputValue);
    if (localValue && (localValue.includes("T") || localValue.includes("Z"))) {
      const date = new Date(localValue);
      if (!isNaN(date.getTime())) {
        const pad = (n: number) => String(n).padStart(2, "0");
        const y = date.getFullYear();
        const m = pad(date.getMonth() + 1);
        const d = pad(date.getDate());
        const h = pad(date.getHours());
        const min = pad(date.getMinutes());
        localValue = field.type === "datetime" ? `${y}-${m}-${d}T${h}:${min}` : `${y}-${m}-${d}`;
      }
    }

    return (
      <DateTimeInput
        type={field.type === "datetime" ? "datetime-local" : field.type}
        label={field.label}
        value={localValue}
        onChange={(event) => {
          const val = event.target.value;
          if (!val) {
            onChange("");
            return;
          }
          // Khi lưu, trình duyệt tự hiểu chuỗi datetime-local là giờ địa phương
          // Chuyển nó thành ISO UTC để lưu vào DB chuẩn xác
          const date = new Date(val);
          onChange(isNaN(date.getTime()) ? "" : date.toISOString());
        }}
      />
    );
  }
  return (
    <Input
      type={field.type === "number" ? "number" : field.type}
      placeholder={field.placeholder}
      value={inputValue}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

function getConfig(resource: ResourceKey) {
  return RESOURCE_CONFIG[resource];
}

function renderValue(config: ReturnType<typeof getConfig>, field: string, value: unknown) {
  if (config.moneyFields?.includes(field)) return formatMoney(value as number | string | null | undefined);
  if (field.toLowerCase().includes("date") || field.endsWith("At")) return formatDate(value as string | Date | null | undefined);
  if (typeof value === "boolean") return value ? "Có" : "Không";
  return viOption(value);
}

function formatDayLabel(value: unknown) {
  const date = new Date(String(value ?? ""));
  if (Number.isNaN(date.getTime())) return "Chưa có ngày";
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

function formatTimeLabel(value: unknown) {
  const date = new Date(String(value ?? ""));
  if (Number.isNaN(date.getTime())) return "Chưa có giờ";
  return new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit" }).format(date);
}

function formatDateTimeLabel(value: unknown) {
  const date = new Date(String(value ?? ""));
  if (Number.isNaN(date.getTime())) return "Chưa có thời gian";
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function dateInRange(value: unknown, fromDate: string, toDate: string) {
  if (!fromDate && !toDate) return true;
  const date = new Date(String(value ?? ""));
  if (Number.isNaN(date.getTime())) return false;
  if (fromDate && date < new Date(`${fromDate}T00:00:00`)) return false;
  if (toDate && date > new Date(`${toDate}T23:59:59.999`)) return false;
  return true;
}

function fieldLabel(config: ReturnType<typeof getConfig>, key: string) {
  return config.fields.find((field) => field.key === key)?.label ?? key;
}

function statusTone(value: unknown) {
  const key = String(value ?? "");
  if (["APPROVED", "PAID", "COMPLETED", "DELIVERED", "AVAILABLE", "ACTIVE", "true"].includes(key)) return "bg-[#FFE4EA] text-[#A84E61] ring-[#F4C7C4]";
  if (["REJECTED", "OVERDUE", "CANCELLED", "BROKEN", "EXPENSE"].includes(key)) return "bg-rose-50 text-rose-700 ring-rose-200";
  if (["PENDING", "DRAFT", "IN_PROGRESS", "REVIEW", "MAINTENANCE"].includes(key)) return "bg-[#FFF3EC] text-[#9B746B] ring-[#F4C7C4]";
  return "bg-[#FFF3EC] text-[#5B342C] ring-[#F4C7C4]";
}

const RowImage = memo(function RowImage({ row, field, index, dense = false }: { row: Row; field?: string; index: number; dense?: boolean }) {
  const src = field ? String(row[field] ?? "") : "";
  const image = src || fallbackImages[index % fallbackImages.length];
  return (
    <div className={cn("flex shrink-0 items-center justify-center overflow-hidden border border-[#F4C7C4] bg-white", dense ? "h-14 w-14 rounded-[1rem] sm:h-16 sm:w-16 sm:rounded-[1.15rem] lg:h-[4.5rem] lg:w-[4.5rem] lg:rounded-[1.25rem]" : "h-14 w-14 rounded-[1rem] sm:h-20 sm:w-20 sm:rounded-[1.35rem] lg:h-24 lg:w-24 lg:rounded-[1.5rem]")}>
      {image ? (
        <img src={image} alt="" className="max-h-full max-w-full object-contain p-1" />
      ) : (
        <div className="grid h-full w-full place-items-center text-[#EA7188]">
          <ImageIcon size={22} />
        </div>
      )}
    </div>
  );
});

function rowGallery(row: Row) {
  const raw = row.galleryUrls;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(String(raw));
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string").slice(0, 5) : [];
  } catch {
    return [];
  }
}

function isImageLike(value: unknown) {
  const url = String(value ?? "").trim();
  if (!url || url === "undefined" || url === "null") return false;
  return /^(https?:|data:image|blob:)/i.test(url) && !/\.pdf($|\?)/i.test(url);
}

function rowImages(row: Row, imageField?: string) {
  const main = imageField ? String(row[imageField] ?? "") : "";
  const attachment = isImageLike(row.attachmentUrl) ? String(row.attachmentUrl) : "";
  return [main, ...rowGallery(row), ...linkedPackageImages(row), attachment].filter((item, index, list) => item && item !== "undefined" && item !== "null" && list.indexOf(item) === index);
}

function galleryFromValue(value: unknown) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(String(value));
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).slice(0, 4) : [];
  } catch {
    return [];
  }
}

function objectValue(value: unknown, key: string): unknown {
  return value && typeof value === "object" && key in value ? (value as Record<string, unknown>)[key] : undefined;
}

function packageImagesFromObject(value: unknown) {
  if (!value || typeof value !== "object") return [];
  const imageUrl = objectValue(value, "imageUrl");
  const galleryUrls = objectValue(value, "galleryUrls");
  return [typeof imageUrl === "string" ? imageUrl : "", ...galleryFromValue(galleryUrls)].filter(Boolean).slice(0, 5);
}

function linkedPackageImages(row: Row) {
  const directPackage = packageImagesFromObject(row.package);
  if (directPackage.length) return directPackage;
  const project = row.project;
  const booking = objectValue(project, "booking") ?? row.booking;
  return packageImagesFromObject(objectValue(booking, "package"));
}

function imageBadgeLabel(resource: ResourceKey, imageIndex: number) {
  if (["transactions", "invoices", "projects"].includes(resource)) {
    return imageIndex === 0 ? "Khách hàng" : "Gói chụp";
  }
  return imageIndex === 0 ? "Ảnh chính" : "Ảnh phụ";
}

function evidenceImageLabel(row: Row, resource: ResourceKey, imageIndex: number, imageField?: string) {
  if (resource === "transactions" && !canPrintInvoice(row)) return imageIndex === 0 ? "Chứng từ" : "Ảnh phụ";
  if (["transactions", "invoices", "projects"].includes(resource) && imageIndex === 0) {
    const primaryImage = imageField ? row[imageField] : row.imageUrl;
    return isImageLike(primaryImage) ? "Khách hàng" : "Gói chụp";
  }
  return imageBadgeLabel(resource, imageIndex);
}

function detailImageGroups(row: Row, resource: ResourceKey, imageField?: string) {
  const images = rowImages(row, imageField);
  const order = ["Khách hàng", "Gói chụp", "Chứng từ", "Ảnh chính", "Ảnh phụ"];
  const groups = new Map<string, Array<{ src: string; index: number }>>();
  images.forEach((src, index) => {
    const label = evidenceImageLabel(row, resource, index, imageField);
    groups.set(label, [...(groups.get(label) ?? []), { src, index }]);
  });
  return [...groups.entries()]
    .sort(([a], [b]) => order.indexOf(a) - order.indexOf(b))
    .map(([label, items]) => ({ label, items }));
}

function canPrintInvoice(row: Row) {
  const note = String(row.note ?? "");
  if (groupBookingSnapshotFromRow(row)) return true;
  return Boolean(row.code) || note.includes("BOOKING_DONE") || String(row.title ?? "").includes("Hoàn tất booking");
}

function receiptEscape(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function nestedName(value: unknown) {
  return value && typeof value === "object" && "name" in value ? String((value as { name?: unknown }).name ?? "") : "";
}

function nestedText(value: unknown, key: string) {
  return value && typeof value === "object" && key in value ? String((value as Record<string, unknown>)[key] ?? "").trim() : "";
}

function firstInvoiceItem(row: Row) {
  const items = Array.isArray(row.items) ? row.items : [];
  const first = items[0];
  return first && typeof first === "object" ? first as Row : null;
}

function receiptSnapshotFromNote(value: unknown) {
  const match = /RECEIPT:(\{.*?\})(?:\s*\||\n|$)/.exec(String(value ?? ""));
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[1]);
    return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function groupBookingSnapshotFromRow(row: Row) {
  const match = String(row.note ?? "").match(/^GROUP_BOOKING:(.+)$/m);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[1]);
    if (!parsed || typeof parsed !== "object" || !Array.isArray((parsed as GroupBookingSnapshot).customers)) return null;
    return parsed as GroupBookingSnapshot;
  } catch {
    return null;
  }
}

function splitBookingProjectName(value: unknown) {
  const text = String(value ?? "");
  const [customerName, ...rest] = text.split(" - ");
  return {
    customerName: customerName?.trim() || "",
    packageName: rest.join(" - ").trim(),
  };
}

function printableInvoiceData(row: Row) {
  const item = firstInvoiceItem(row);
  const noteCode = /Hóa đơn:\s*(meoxinh\d+)/i.exec(String(row.note ?? ""))?.[1];
  const projectName = nestedName(row.project);
  const snapshot = receiptSnapshotFromNote(row.note);
  const projectParts = splitBookingProjectName(projectName);
  const project = row.project && typeof row.project === "object" ? row.project : null;
  const linkedBooking = (row.booking && typeof row.booking === "object" ? row.booking : null)
    ?? (project ? objectValue(project, "booking") : null);
  const linkedPackage = linkedBooking ? objectValue(linkedBooking, "package") : null;
  const bookingPackageName = nestedText(linkedBooking, "packageName");
  const linkedPackageName = nestedName(linkedPackage);
  const serviceName = nestedName(row.service) || (project ? nestedName(objectValue(project, "service")) : "");
  const customerName = String(snapshot?.customerName || nestedName(row.customer) || row.customerName || projectParts.customerName || "Khách hàng");
  const title = String(snapshot?.packageName || item?.description || row.packageName || bookingPackageName || linkedPackageName || serviceName || projectParts.packageName || "Gói dịch vụ");
  const amount = item?.total ?? row.total ?? row.paid ?? row.amount ?? 0;
  const code = String(row.code ?? snapshot?.invoiceCode ?? noteCode ?? "meoxinh--");
  
  let originalPrice = snapshot?.originalPrice ? Number(snapshot.originalPrice) : Number(amount);
  let discountLabel = snapshot?.discountLabel ? String(snapshot.discountLabel) : "";
  let discountPercent = snapshot?.discountPercent ? String(snapshot.discountPercent) : "";

  // Fallback parsing from note for legacy transactions
  if (!discountLabel && row.note) {
    const match = /Giảm giá:\s*([^\n\r|]+)(?:\s*\((\d+%)\))?/.exec(String(row.note));
    if (match) {
      discountLabel = match[1].trim();
      if (match[2]) discountPercent = match[2];
      
      // Try to calculate original price
      if (discountPercent && Number(amount) > 0) {
        const p = parseInt(discountPercent);
        if (p > 0 && p < 100) {
          originalPrice = Math.round(Number(amount) / (1 - p / 100));
        }
      } else {
        const moneyMatch = /([\d.,]+)\s*đ/i.exec(discountLabel);
        if (moneyMatch) {
          const dAmount = Number(moneyMatch[1].replace(/[.,]/g, ""));
          if (!isNaN(dAmount) && dAmount > 0) {
            originalPrice = Number(amount) + dAmount;
          }
        }
      }
    }
  }

  return {
    code,
    customerName,
    packageName: title.replace(/\s+-\s+Khách hàng$/i, ""),
    categoryName: String(snapshot?.categoryName ?? row.categoryName ?? "STUDIO"),
    amount,
    originalPrice,
    discountLabel,
    discountPercent,
  };
}

function cleanSystemNote(row: Row) {
  const note = String(row.note ?? "").trim();
  if (!note) return "";
  if (note.includes("GROUP_BOOKING_DONE") || note.includes("GROUP_BOOKING:")) {
    return "Tự động cộng doanh thu khi booking nhóm hoàn tất.";
  }
  if (note.includes("BOOKING_DONE") || note.includes("RECEIPT:")) {
    return "Tự động cộng doanh thu khi booking hoàn tất.";
  }
  const invoiceCode = printableInvoiceData(row).code;
  const withoutReceipt = note
    .replace(/INVOICE_RESERVED:(?:Group-meoxinh\d+|meoxinh\d+)/gi, "")
    .replace(/^GROUP_BOOKING:.+$/gm, "")
    .replace(/GROUP_BOOKING_DONE:[^\n|]+/g, "")
    .replace(/BOOKING_DONE:[^\s|]+/g, "")
    .replace(/RECEIPT:\{.*?\}(?=\s*\||\n|$)/g, "")
    .replace(/H(?:óa|Ă³a)\s*(?:đơn|Ä‘Æ¡n):\s*[^\s|]+/gi, invoiceCode ? `Hóa đơn: ${invoiceCode}` : "")
    .replace(/T(?:ự|á»±)\s*(?:động|Ä‘á»™ng)\s*(?:cộng|cá»™ng)\s*doanh thu khi booking ho(?:àn|Ă n) t(?:ất|áº¥t)\.?/gi, "Tự động cộng doanh thu khi booking hoàn tất.")
    .replace(/\s*\|\s*/g, " · ")
    .replace(/\s*·\s*·\s*/g, " · ")
    .replace(/^(\s*·\s*)+|(\s*·\s*)+$/g, "")
    .trim();
  return withoutReceipt || (String(row.title ?? "").includes("Hoàn tất booking") ? "Tự động cộng doanh thu khi booking hoàn tất." : note);
}

function stripSystemNote(value: unknown) {
  const note = String(value ?? "").trim();
  if (!note) return "";
  return note
    .replace(/INVOICE_RESERVED:(?:Group-meoxinh\d+|meoxinh\d+)/gi, "")
    .replace(/^GROUP_BOOKING:.+$/gm, "")
    .replace(/GROUP_BOOKING_DONE:[^\n|]+/g, "")
    .replace(/BOOKING_DONE:[^\s|]+/g, "")
    .replace(/RECEIPT:\{.*?\}(?=\s*\||\n|$)/g, "")
    .replace(/Hóa đơn:\s*[^\s|]+/gi, "")
    .replace(/Tự động cộng doanh thu khi booking hoàn tất\.?/gi, "")
    .replace(/Tự động cộng doanh thu khi booking nhóm hoàn tất\.?/gi, "")
    .replace(/\s*\|\s*/g, "\n")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n")
    .trim();
}

function isGeneratedSystemNoteLabel(value: unknown) {
  const note = String(value ?? "").trim();
  return note === "Tự động cộng doanh thu khi booking hoàn tất." || note === "Tự động cộng doanh thu khi booking nhóm hoàn tất.";
}

function editableNoteValue(row: Row) {
  const userNote = stripSystemNote(row.note);
  if (userNote) return userNote;
  return extractSystemNote(row.note) ? cleanSystemNote(row) : "";
}

function extractSystemNote(value: unknown) {
  const note = String(value ?? "").trim();
  if (!note) return "";
  const parts = [
    ...note.match(/^GROUP_BOOKING:.+$/gm) ?? [],
    ...note.match(/INVOICE_RESERVED:(?:Group-meoxinh\d+|meoxinh\d+)/gi) ?? [],
    ...note.match(/GROUP_BOOKING_DONE:[^\n|]+/g) ?? [],
    ...note.match(/BOOKING_DONE:[^\s|]+/g) ?? [],
    ...note.match(/RECEIPT:\{.*?\}(?=\s*\||\n|$)/g) ?? [],
    ...note.match(/Hóa đơn:\s*[^\s|]+/gi) ?? [],
  ];
  return [...new Set(parts.map((part) => part.trim()).filter(Boolean))].join(" | ");
}

function mergeSystemNote(userNote: unknown, systemNote: string) {
  const cleanUserNote = String(userNote ?? "").trim();
  if (!systemNote) return cleanUserNote || null;
  if (isGeneratedSystemNoteLabel(cleanUserNote)) return systemNote;
  return [systemNote, cleanUserNote].filter(Boolean).join(" | ");
}

function printResourceInvoice(row: Row) {
  const printable = printableInvoiceData(row);
  const code = printable.code;
  const invoiceDate = row.issueDate ?? row.occurredAt ?? row.createdAt;
  const formattedAmount = formatMoney(printable.amount as string | number | null | undefined);
  const paymentQrUrl = buildPaymentQrUrl(printable.amount, code);
  const qrBlock = paymentQrUrl
    ? `<div class="sep"></div><div class="center qr"><img src="${receiptEscape(paymentQrUrl)}" alt="QR thanh toán" /><div class="small bold">Quét mã để thanh toán</div><div class="small">Số tiền: ${receiptEscape(formattedAmount)}</div></div>`
    : "";
  const html = `<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>${receiptEscape(code)}</title>
  <style>
    *{box-sizing:border-box}
    body{margin:0;background:#fff7fb;color:#4b2a25;font-family:Arial,"Helvetica Neue",sans-serif}
    .receipt{width:80mm;max-width:310px;margin:0 auto;padding:10px 9px;font-size:12px;line-height:1.38;background:#fff;border:1px solid #f6c6d4}
    .center{text-align:center}.bold{font-weight:700}
    .brand-box{display:flex;align-items:center;gap:8px;margin-bottom:8px;padding:8px;border-radius:14px;background:#fff0f5;border:1px solid #f5b8ca}
    .logo{width:34px;height:34px;border-radius:50%;background:#fff;object-fit:contain;border:1px solid #f5b8ca}
    .brand{font-size:15px;font-weight:900;letter-spacing:.9px;text-transform:uppercase;color:#e86b88}
    .address{margin-top:3px;font-size:10.5px;line-height:1.35;color:#7a5750}
    .title{margin:8px 0 6px;padding:7px 0;border-radius:12px;background:#e86b88;color:#fff;font-size:14px;font-weight:900;text-align:center;text-transform:uppercase;letter-spacing:.4px}
    .sep{margin:8px 0;border-top:1px dashed #e9a8b8}.solid{margin:8px 0;border-top:1px solid #f0b4c1}
    .row{display:flex;justify-content:space-between;align-items:flex-start;gap:8px}
    .left{flex:1;min-width:0;overflow-wrap:anywhere}.right{flex:0 0 auto;text-align:right;white-space:nowrap}
    .info{margin-top:4px}.label{flex:0 0 86px}
    .section{margin-top:4px;font-weight:800;text-transform:uppercase}
    .item{margin-top:5px}.qty{padding-left:12px}
    .total{padding:8px;border-radius:12px;background:#fff0f5;font-size:13px;color:#d94f73}
    .status{text-align:center;font-weight:900;color:#0f9f6e}.thanks{margin-top:8px;line-height:1.45}
    .small{font-size:11px}.qr{margin-top:8px;padding:8px;border-radius:14px;background:#fff;border:1px solid #cfcfcf;color:#222}
    .qr img{width:128px;height:128px;object-fit:contain;margin:2px auto 4px;display:block}
    @page{margin:0}
    @media print{html,body{width:100%;background:#fff;color:#000}.receipt{width:100%;max-width:80mm;margin:0 auto;padding:8px 6px;border-color:#000;border:none!important;box-shadow:none!important}.brand-box,.total,.qr{background:#fff;border-color:#000;color:#000}.brand,.address,.title,.status{color:#000}.title{background:#fff;border:1px solid #000}.sep{border-top-color:#777}.solid{border-top-color:#000}.no-print{display:none!important}}
    .toolbar{display:flex;justify-content:center;gap:10px;margin:0 auto 12px;max-width:310px;width:100%;padding:0 4px}
    .btn{flex:1;padding:10px 14px;font-size:13px;font-weight:bold;border:none;border-radius:20px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;box-shadow:0 4px 12px rgba(232,107,136,0.15);transition:all 0.2s ease;font-family:inherit}
    .btn-print{background:#e86b88;color:white}
    .btn-print:active{transform:scale(0.96);background:#d94f73}
    .btn-close{background:#f3f4f6;color:#4b5563}
    .btn-close:active{transform:scale(0.96);background:#e5e7eb}
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
    <div class="info row"><span class="label">Mã hóa đơn</span><span class="left">: ${receiptEscape(code)}</span></div>
    <div class="info row"><span class="label">👤 Khách</span><span class="left">: ${receiptEscape(printable.customerName)}</span></div>
    <div class="info row"><span class="label">⏰ Giờ</span><span class="left">: ${receiptEscape(formatDateTimeLabel(invoiceDate))}</span></div>
    <div class="sep"></div>
    <div class="section">📸 GÓI CHỤP</div>
    <div>[${receiptEscape(printable.categoryName)}] ${receiptEscape(printable.packageName)}</div>
    <div class="sep"></div>
    <div class="section">💰 CHI TIẾT</div>
    <div class="item"><div>${receiptEscape(printable.packageName)}</div><div class="row qty"><span>x1</span><span class="right">${receiptEscape(formatMoney(printable.originalPrice as string | number | null))}</span></div></div>
    <div class="solid"></div>
    ${printable.discountLabel ? `
    <div class="row info" style="margin-bottom: 4px; font-size: 11px; color: #7a5750;">
      <span>Giá gốc</span>
      <span class="right">${receiptEscape(formatMoney(printable.originalPrice as string | number | null))}</span>
    </div>
    <div class="row info" style="margin-bottom: 6px; font-weight: bold; color: #e86b88;">
      <span>🏷️ Giảm giá ${printable.discountPercent ? `(${receiptEscape(printable.discountPercent)})` : ""}</span>
      <span class="right">-${receiptEscape(printable.discountLabel)}</span>
    </div>
    <div class="solid" style="margin: 4px 0;"></div>
    ` : ""}
    <div class="row bold total"><span>TỔNG THANH TOÁN</span><span class="right">${receiptEscape(formattedAmount)}</span></div>
    <div class="sep"></div>
    <div class="status">ĐÃ THANH TOÁN ✓</div>
    ${qrBlock}
    <div class="sep"></div>
    <div class="center thanks">Cảm ơn quý khách ♥<br/><span class="bold">MÈOO XINHH STUDIO 🐾</span></div>
  </div>
  <script>window.onload=()=>{try{window.print();}catch(e){console.error(e);}};</script>
</body>
</html>`;
  const popup = window.open("", "_blank", "width=900,height=1000");
  if (!popup) return;
  popup.document.write(html);
  popup.document.close();
}

function openPrintHtml(html: string, name = "_blank") {
  const popup = window.open("", name, "width=900,height=1000");
  if (!popup) return;
  popup.document.write(html);
  popup.document.close();
}

function groupInvoiceCode(group: GroupBookingSnapshot) {
  return group.paymentInfo?.invoiceCode || group.customers[0]?.invoiceCode || "Group-meoxinh--";
}

function printGroupInvoice(group: GroupBookingSnapshot) {
  return printGroupInvoiceClean(group);
  const code = groupInvoiceCode(group);
  const rows = group.customers.map((customer, index) => {
    const sub = Number(customer.subtotal ?? customer.totalAmount);
    const fin = Number(customer.totalAmount);
    const disc = fin < sub;
    return `<div class="item"><div class="row"><span class="left">${index + 1}. ${receiptEscape(customer.customerName)}</span><span class="right">${disc ? `<span style="text-decoration:line-through;color:#7a5750;font-size:11px">${receiptEscape(formatMoney(sub))}</span> ` : ""}${receiptEscape(formatMoney(fin))}</span></div><div class="small muted">${receiptEscape(customer.packageName)}</div>${disc ? `<div class="small" style="color:#e86b88">🏷️ Giảm ${receiptEscape(formatMoney(sub - fin))}</div>` : ""}</div>`;
  }).join("");
  const html = `<!doctype html><html lang="vi"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${receiptEscape(code)}</title><style>
    *{box-sizing:border-box}body{margin:0;background:#fff7fb;color:#4b2a25;font-family:Arial,sans-serif;padding-top:10px}.receipt{width:80mm;max-width:310px;margin:0 auto;padding:10px 9px;font-size:12px;line-height:1.38;background:#fff;border:1px solid #f6c6d4}.center{text-align:center}.bold{font-weight:700}.muted{color:#7a5750}.brand{font-size:15px;font-weight:900;text-transform:uppercase;color:#e86b88}.title{margin:8px 0 6px;padding:7px 0;border-radius:12px;background:#e86b88;color:#fff;font-size:14px;font-weight:900;text-align:center;text-transform:uppercase}.sep{margin:8px 0;border-top:1px dashed #e9a8b8}.solid{margin:8px 0;border-top:1px solid #f0b4c1}.row{display:flex;justify-content:space-between;align-items:flex-start;gap:8px}.left{flex:1;min-width:0;overflow-wrap:anywhere}.right{flex:0 0 auto;text-align:right;white-space:nowrap}.item{margin-top:6px}.small{font-size:11px}.total{padding:8px;border-radius:12px;background:#fff0f5;font-size:13px;color:#d94f73}.toolbar{display:flex;justify-content:center;gap:10px;margin:0 auto 12px;max-width:310px}.btn{flex:1;padding:10px 14px;font-size:13px;font-weight:700;border:0;border-radius:20px;cursor:pointer}.btn-print{background:#e86b88;color:#fff}.btn-close{background:#f3f4f6;color:#4b5563}@page{margin:0}@media print{.no-print{display:none!important}body{background:#fff;padding-top:0}.receipt{border:0;max-width:80mm}.title,.total{background:#fff;color:#000;border:1px solid #000}}
  </style></head><body><div class="no-print toolbar"><button class="btn btn-print" onclick="window.print()">In hóa đơn tổng</button><button class="btn btn-close" onclick="window.close()">Đóng</button></div><div class="receipt">
    <div class="center"><div class="brand">Mèo Xinhh Studio</div><div class="small muted">${receiptEscape(STUDIO_PHONE)}</div><div class="small muted">${receiptEscape(STUDIO_ADDRESS)}</div></div>
    <div class="title">Hóa đơn nhóm</div><div class="row"><span>Mã hóa đơn</span><span class="right">${receiptEscape(code)}</span></div><div class="row"><span>Nhóm</span><span class="right">${receiptEscape(group.groupName)}</span></div><div class="row"><span>Thời gian</span><span class="right">${receiptEscape(formatDateTimeLabel(group.paymentInfo?.paidAt || group.createdAt))}</span></div><div class="sep"></div>${rows}<div class="solid"></div><div class="row"><span>Tạm tính</span><span class="right">${receiptEscape(formatMoney(group.subtotal))}</span></div>${group.discount > 0 ? `<div class="row"><span>Giảm giá</span><span class="right">-${receiptEscape(formatMoney(group.discount))}</span></div>` : ""}${group.extraFee > 0 ? `<div class="row"><span>Phí phát sinh</span><span class="right">${receiptEscape(formatMoney(group.extraFee))}</span></div>` : ""}<div class="row bold total"><span>Tổng thanh toán</span><span class="right">${receiptEscape(formatMoney(group.totalAmount))}</span></div><div class="sep"></div><div class="center bold">ĐÃ THANH TOÁN</div></div><script>window.onload=()=>{try{window.print();}catch(e){console.error(e);}};</script></body></html>`;
  openPrintHtml(html);
}

function printGroupCustomerBill(group: GroupBookingSnapshot, customer: GroupBookingCustomerSnapshot) {
  return printGroupCustomerBillClean(group, customer);
  const code = customer.invoiceCode || groupInvoiceCode(group);
  const qr = buildPaymentQrUrl(customer.totalAmount, code);
  const qrBlock = qr ? `<div class="sep"></div><div class="center qr"><img src="${receiptEscape(qr)}" alt="QR"/><div class="small bold">Quét mã thanh toán</div></div>` : "";
  const html = `<!doctype html><html lang="vi"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${receiptEscape(code)}</title><style>
    *{box-sizing:border-box}body{margin:0;background:#fff;color:#111;font-family:Arial,sans-serif}.receipt{width:80mm;max-width:310px;margin:0 auto;padding:8px 6px;font-size:11.5px;line-height:1.34}.center{text-align:center}.bold{font-weight:700}.brand{font-size:14px;font-weight:900;text-transform:uppercase}.sep{margin:7px 0;border-top:1px dashed #777}.row{display:flex;justify-content:space-between;align-items:flex-start;gap:8px}.left{flex:1;min-width:0;overflow-wrap:anywhere}.right{flex:0 0 auto;text-align:right;white-space:nowrap}.small{font-size:10.5px}.total{font-size:13px;font-weight:900}.qr img{width:118px;height:118px;object-fit:contain}.toolbar{display:flex;gap:8px;padding:8px}.btn{flex:1;padding:9px;border:0;border-radius:12px;font-weight:700}.btn-print{background:#111;color:#fff}@page{margin:0}@media print{.no-print{display:none!important}}
  </style></head><body><div class="no-print toolbar"><button class="btn btn-print" onclick="window.print()">In bill</button><button class="btn" onclick="window.close()">Đóng</button></div><div class="receipt"><div class="center"><div class="brand">Mèo Xinhh Studio</div><div class="small">${receiptEscape(STUDIO_PHONE)}</div><div class="small">${receiptEscape(STUDIO_ADDRESS)}</div></div><div class="sep"></div><div class="row"><span>Mã đơn</span><span class="right">${receiptEscape(code)}</span></div><div class="row"><span>Khách</span><span class="right">${receiptEscape(customer.customerName)}</span></div><div class="row"><span>Gói</span><span class="right">${receiptEscape(customer.packageName)}</span></div><div class="row"><span>Ngày</span><span class="right">${receiptEscape(formatDateTimeLabel(group.paymentInfo?.paidAt || group.createdAt))}</span></div><div class="sep"></div><div class="row"><span>Tạm tính</span><span class="right">${receiptEscape(formatMoney(customer.subtotal ?? customer.totalAmount))}</span></div>${(customer.extraFee ?? 0) > 0 ? `<div class="row"><span>Phí phát sinh</span><span class="right">${receiptEscape(formatMoney(customer.extraFee))}</span></div>` : ""}<div class="row total"><span>Tổng</span><span class="right">${receiptEscape(formatMoney(customer.totalAmount))}</span></div>${qrBlock}<div class="sep"></div><div class="center bold">Cảm ơn quý khách</div></div><script>window.onload=()=>{try{window.print();}catch(e){console.error(e);}};</script></body></html>`;
  openPrintHtml(html);
}

function printGroupInvoiceClean(group: GroupBookingSnapshot) {
  {
    const code = groupInvoiceCode(group);
    openReceiptPrintWindow(buildStudioReceiptHtml({
      title: "HÓA ĐƠN THANH TOÁN",
      code,
      customer: group.groupName,
      time: formatDateTimeLabel(group.paymentInfo?.paidAt || group.createdAt),
      packageTitle: `Booking nhóm - ${group.groupName}`,
      lines: group.customers.map((customer) => {
        const original = Number(customer.subtotal ?? customer.totalAmount);
        const finalAmount = Number(customer.totalAmount);
        return {
          name: customer.customerName,
          description: customer.packageName,
          amount: finalAmount,
          originalAmount: original,
          discountText: finalAmount < original ? `Giảm ${formatMoney(original - finalAmount)}` : undefined,
        };
      }),
      subtotal: group.subtotal,
      discount: group.discount,
      extraFee: group.extraFee,
      total: group.totalAmount,
      statusText: "ĐÃ THANH TOÁN ✓",
      qrUrl: buildPaymentQrUrl(group.totalAmount, code),
      qrAmountLabel: `Số tiền: ${formatMoney(group.totalAmount)}`,
      printButtonLabel: "In hóa đơn",
    }));
    return;
  }
  const code = groupInvoiceCode(group);
  const rows = group.customers.map((customer, index) => `
    <div class="item">
      <div class="row"><span class="left">${index + 1}. ${receiptEscape(customer.customerName)}</span><span class="right">${receiptEscape(formatMoney(customer.totalAmount))}</span></div>
      <div class="small muted">${receiptEscape(customer.packageName)}</div>
    </div>
  `).join("");
  const html = `<!doctype html><html lang="vi"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/><title>Hóa đơn ${receiptEscape(code)}</title><style>
    *{box-sizing:border-box}body{margin:0;background:#fff7fb;color:#4b2a25;font-family:Arial,"Helvetica Neue",sans-serif;padding-top:10px}.receipt{width:80mm;max-width:310px;margin:0 auto;padding:10px 9px;font-size:12px;line-height:1.38;background:#fff;border:1px solid #f6c6d4}.center{text-align:center}.bold{font-weight:700}.muted{color:#7a5750}.brand-box{display:flex;align-items:center;gap:8px;margin-bottom:8px;padding:8px;border-radius:14px;background:#fff0f5;border:1px solid #f5b8ca}.logo{width:34px;height:34px;border-radius:50%;background:#fff;object-fit:contain;border:1px solid #f5b8ca}.brand{font-size:15px;font-weight:900;letter-spacing:.9px;text-transform:uppercase;color:#e86b88}.address{margin-top:3px;font-size:10.5px;line-height:1.35;color:#7a5750}.title{margin:8px 0 6px;padding:7px 0;border-radius:12px;background:#e86b88;color:#fff;font-size:14px;font-weight:900;text-align:center;text-transform:uppercase;letter-spacing:.4px}.sep{margin:8px 0;border-top:1px dashed #e9a8b8}.solid{margin:8px 0;border-top:1px solid #f0b4c1}.row{display:flex;justify-content:space-between;align-items:flex-start;gap:8px}.left{flex:1;min-width:0;overflow-wrap:anywhere}.right{flex:0 0 auto;text-align:right;white-space:nowrap}.info{margin-top:4px}.label{flex:0 0 86px}.section{margin-top:4px;font-weight:800;text-transform:uppercase}.item{margin-top:5px}.small{font-size:11px}.total{padding:8px;border-radius:12px;background:#fff0f5;font-size:13px;color:#d94f73}.status{text-align:center;font-weight:900;color:#0f9f6e}.thanks{margin-top:8px;line-height:1.45}.toolbar{display:flex;justify-content:center;gap:10px;margin:0 auto 12px;max-width:310px;width:100%;padding:0 4px}.btn{flex:1;padding:10px 14px;font-size:13px;font-weight:bold;border:0;border-radius:20px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;box-shadow:0 4px 12px rgba(232,107,136,.15);font-family:inherit}.btn-print{background:#e86b88;color:white}.btn-close{background:#f3f4f6;color:#4b5563}@page{margin:0}@media print{.no-print{display:none!important}body{background:#fff;margin:0;padding-top:0;color:#000}.receipt{width:100%;max-width:80mm;margin:0 auto;padding:8px 6px;border:0!important;box-shadow:none!important}.brand-box,.total{background:#fff;border-color:#000;color:#000}.brand,.address,.title,.status{color:#000}.title{background:#fff;border:1px solid #000}.sep{border-top-color:#777}.solid{border-top-color:#000}}
  </style></head><body><div class="no-print toolbar"><button class="btn btn-print" onclick="window.print()">In hóa đơn</button><button class="btn btn-close" onclick="window.close()">Đóng</button></div><div class="receipt">
    <div class="brand-box"><img class="logo" src="/be-meo-studio-avatar.svg" alt="Mèoo Xinhh"/><div><div class="brand">Mèoo Xinhh Studio</div><div class="address">make & photo</div><div class="address">☎ ${receiptEscape(STUDIO_PHONE)}</div><div class="address">⌂ ${receiptEscape(STUDIO_ADDRESS)}</div></div></div>
    <div class="title">HÓA ĐƠN THANH TOÁN</div>
    <div class="info row"><span class="label">Mã hóa đơn</span><span class="left">: ${receiptEscape(code)}</span></div>
    <div class="info row"><span class="label">Khách</span><span class="left">: ${receiptEscape(group.groupName)}</span></div>
    <div class="info row"><span class="label">Giờ</span><span class="left">: ${receiptEscape(formatDateTimeLabel(group.paymentInfo?.paidAt || group.createdAt))}</span></div>
    <div class="sep"></div><div class="section">GÓI CHỤP</div><div>Booking nhóm - ${receiptEscape(group.groupName)}</div><div class="sep"></div><div class="section">CHI TIẾT</div>${rows}<div class="solid"></div>
    ${group.extraFee > 0 ? `<div class="row info"><span>Phí phát sinh</span><span class="right">${receiptEscape(formatMoney(group.extraFee))}</span></div>` : ""}<div class="row bold total"><span>TỔNG THANH TOÁN</span><span class="right">${receiptEscape(formatMoney(group.totalAmount))}</span></div><div class="sep"></div><div class="status">ĐÃ THANH TOÁN ✓</div><div class="sep"></div><div class="center qr"><img src="${receiptEscape(buildPaymentQrUrl(group.totalAmount, code))}" alt="QR" style="width:128px;height:128px;object-fit:contain;margin:4px auto;display:block"/><div class="small bold">Quét mã để thanh toán</div></div><div class="sep"></div><div class="center thanks">Cảm ơn quý khách ♥<br/><span class="bold">MÈOO XINHH STUDIO</span></div></div><script>window.onload=()=>{try{window.print();}catch(e){console.error(e);}};</script></body></html>`;
  openPrintHtml(html);
}

function printGroupCustomerBillClean(group: GroupBookingSnapshot, customer: GroupBookingCustomerSnapshot) {
  {
    const code = customer.invoiceCode || groupInvoiceCode(group);
    const subtotal = Number(customer.subtotal ?? customer.totalAmount);
    const total = Number(customer.totalAmount);
    openReceiptPrintWindow(buildStudioReceiptHtml({
      title: "HÓA ĐƠN THANH TOÁN",
      code,
      customer: customer.customerName,
      time: formatDateTimeLabel(group.paymentInfo?.paidAt || group.createdAt),
      packageTitle: customer.packageName,
      packageSubtitle: `Booking nhóm - ${group.groupName}`,
      lines: [{
        name: customer.packageName,
        description: group.groupName,
        quantity: "x1",
        amount: total,
        originalAmount: subtotal,
        discountText: total < subtotal ? `Giảm ${formatMoney(subtotal - total)}` : undefined,
      }],
      subtotal,
      extraFee: customer.extraFee ?? 0,
      total,
      statusText: "ĐÃ THANH TOÁN ✓",
      qrUrl: buildPaymentQrUrl(total, code),
      qrAmountLabel: `Số tiền: ${formatMoney(total)}`,
      printButtonLabel: "In hóa đơn",
    }));
    return;
  }
  const code = customer.invoiceCode || groupInvoiceCode(group);
  const qr = buildPaymentQrUrl(customer.totalAmount, code);
  const qrBlock = qr ? `<div class="sep"></div><div class="center qr"><img src="${receiptEscape(qr)}" alt="QR"/><div class="small bold">Quét mã thanh toán</div></div>` : "";
  const html = `<!doctype html><html lang="vi"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${receiptEscape(code)}</title><style>
    *{box-sizing:border-box}body{margin:0;background:#fff;color:#111;font-family:Arial,sans-serif}.receipt{width:80mm;max-width:310px;margin:0 auto;padding:8px 6px;font-size:11.5px;line-height:1.34}.center{text-align:center}.bold{font-weight:700}.brand{font-size:14px;font-weight:900;text-transform:uppercase}.sep{margin:7px 0;border-top:1px dashed #777}.row{display:flex;justify-content:space-between;align-items:flex-start;gap:8px}.right{flex:0 0 auto;text-align:right;white-space:nowrap}.small{font-size:10.5px}.total{font-size:13px;font-weight:900}.qr img{width:118px;height:118px;object-fit:contain}.toolbar{display:flex;gap:8px;padding:8px}.btn{flex:1;padding:9px;border:0;border-radius:12px;font-weight:700}.btn-print{background:#111;color:#fff}@page{margin:0}@media print{.no-print{display:none!important}}
  </style></head><body><div class="no-print toolbar"><button class="btn btn-print" onclick="window.print()">In bill</button><button class="btn" onclick="window.close()">Đóng</button></div><div class="receipt"><div class="center"><div class="brand">Mèoo Xinhh Studio</div><div class="small">${receiptEscape(STUDIO_PHONE)}</div><div class="small">${receiptEscape(STUDIO_ADDRESS)}</div></div><div class="sep"></div><div class="row"><span>Mã đơn</span><span class="right">${receiptEscape(code)}</span></div><div class="row"><span>Khách</span><span class="right">${receiptEscape(customer.customerName)}</span></div><div class="row"><span>Gói</span><span class="right">${receiptEscape(customer.packageName)}</span></div><div class="row"><span>Ngày</span><span class="right">${receiptEscape(formatDateTimeLabel(group.paymentInfo?.paidAt || group.createdAt))}</span></div><div class="sep"></div><div class="row"><span>Tạm tính</span><span class="right">${receiptEscape(formatMoney(customer.subtotal ?? customer.totalAmount))}</span></div>${(customer.extraFee ?? 0) > 0 ? `<div class="row"><span>Phí phát sinh</span><span class="right">${receiptEscape(formatMoney(customer.extraFee))}</span></div>` : ""}<div class="row total"><span>Tổng</span><span class="right">${receiptEscape(formatMoney(customer.totalAmount))}</span></div>${qrBlock}<div class="sep"></div><div class="center bold">Cảm ơn quý khách</div></div><script>window.onload=()=>{try{window.print();}catch(e){console.error(e);}};</script></body></html>`;
  openPrintHtml(html);
}

const PrintInvoiceMenu = memo(function PrintInvoiceMenu({ row }: { row: Row }) {
  const [showConfirm, setShowConfirm] = useState(false);
  const groupBooking = groupBookingSnapshotFromRow(row);

  if (!canPrintInvoice(row)) return null;

  return (
    <>
      <Button
        variant="secondary"
        size="icon"
        className="h-10 w-10 shrink-0 rounded-2xl border-2 border-[#F4C7C4] bg-white text-[#EA7188] hover:bg-[#FFF3EC] active:scale-95 transition"
        aria-label="In hóa đơn"
        onClick={(event) => {
          event.stopPropagation();
          setShowConfirm(true);
        }}
      >
        <Printer size={16} strokeWidth={2.5} />
      </Button>

      {showConfirm && (
        <Portal>
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 animate-in fade-in-0 duration-200" onClick={(e) => e.stopPropagation()}>
            <div 
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-md" 
              onClick={() => setShowConfirm(false)} 
            />

            <div className="relative w-full max-w-sm transform overflow-hidden rounded-[2.25rem] border border-white bg-white/95 p-6 text-center shadow-[0_24px_70px_rgba(184,95,108,0.22)] backdrop-blur-xl animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full mb-4">
                <div className="grid h-16 w-16 place-items-center overflow-hidden rounded-full bg-[#FFF0F4] p-1.5 ring-8 ring-[#FFE4EA]/60">
                  <Printer size={32} className="text-[#EA7188] animate-bounce" />
                </div>
              </div>

              <h3 className="text-lg font-black text-[#5B342C]">
                Xác nhận in hóa đơn
              </h3>

              <p className="mt-3 whitespace-normal break-words text-sm font-semibold leading-relaxed text-[#7B554D]">
                Bạn có chắc chắn muốn in lại hóa đơn cho giao dịch này không?
              </p>

              <div className="mt-6 grid grid-cols-2 gap-3">
                <Button 
                  variant="secondary"
                  className="h-12 w-full rounded-2xl text-sm font-black border border-[#F4C7C4] text-[#7B554D] hover:bg-[#FFF3EC] active:scale-[0.98] transition"
                  onClick={() => setShowConfirm(false)}
                >
                  Hủy bỏ
                </Button>
                <Button 
                  className="h-12 w-full rounded-2xl text-sm font-black bg-[#EA7188] text-white hover:bg-[#E85C77] active:scale-[0.98] shadow-[0_8px_20px_rgba(234,113,136,0.25)] transition"
                  onClick={() => {
                    setShowConfirm(false);
                    if (groupBooking) printGroupInvoice(groupBooking);
                    else printResourceInvoice(row);
                  }}
                >
                  Đồng ý in
                </Button>
              </div>
            </div>
          </div>
        </Portal>
      )}
    </>
  );
});

function splitFields(fields: FieldConfig[]) {
  return {
    image: fields.filter((field) => field.type === "image"),
    main: fields.filter((field) => !["image", "gallery", "textarea"].includes(field.type)),
    note: fields.filter((field) => field.type === "textarea"),
  };
}

function detailFields(config: ReturnType<typeof getConfig>, resource: ResourceKey) {
  if (resource === "bookings") {
    return ["title", "studioRoom", "startAt", "endAt", "status", "deposit", "total"];
  }
  if (resource === "projects") {
    return ["code", "name", "status", "amount", "dueAmount", "deadlineAt"];
  }
  if (resource === "invoices") {
    return ["code", "status", "issueDate", "dueDate", "total", "paid", "due"];
  }
  return config.fields.filter((field) => !["image", "gallery", "textarea"].includes(field.type)).map((field) => field.key);
}

function cardInfoFields(config: ReturnType<typeof getConfig>, resource: ResourceKey, richInfoCard: boolean) {
  if (resource === "customers") return ["phone", "email", "source", "totalSpent", "note"];
  return detailFields(config, resource)
    .filter((field) => !richInfoCard || field !== config.primaryField)
    .slice(0, richInfoCard ? 8 : 4);
}

function nestedImage(value: unknown, key: string) {
  return value && typeof value === "object" && key in value ? String((value as Record<string, unknown>)[key] ?? "") : "";
}

function financialCustomerImage(row: Row, resource: ResourceKey) {
  const rowImage = isImageLike(row.imageUrl) ? String(row.imageUrl) : "";
  if (resource === "transactions" && rowImage) return rowImage;

  const linkedCustomerAvatar = nestedImage(row.customer, "avatarUrl");
  if (isImageLike(linkedCustomerAvatar)) return linkedCustomerAvatar;

  if (!rowImage) return "";
  if (resource !== "transactions") return rowImage;

  const note = String(row.note ?? "");
  return note.includes("BOOKING_DONE") || note.includes("RECEIPT:") ? rowImage : "";
}

function financialPackageImage(row: Row) {
  return rowGallery(row)[0] ?? linkedPackageImages(row)[0] ?? "";
}

function financialPackageImageIndex(row: Row, resource: ResourceKey) {
  return financialCustomerImage(row, resource) ? 1 : 0;
}

function financialMoneyTone(resource: ResourceKey, row: Row) {
  if (String(row.type ?? "") === "EXPENSE") return "text-red-700";
  if (String(row.type ?? "") === "INCOME") return "text-emerald-700";
  if (resource === "projects") return "text-purple-700";
  if (resource === "invoices") return "text-amber-700";
  return "text-[#5B342C]";
}

function financialAmountPrefix(row: Row) {
  if (String(row.type ?? "") === "EXPENSE") return "-";
  if (String(row.type ?? "") === "INCOME") return "+";
  return "";
}

function FinancialCustomerAvatar({ row, resource }: { row: Row; resource: ResourceKey }) {
  const image = financialCustomerImage(row, resource);

  if (image) {
    return (
      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-2xl border border-[#F4C7C4] bg-[#FFF3EC] shadow-sm">
        <img src={image} alt="" className="h-full w-full object-cover" />
      </div>
    );
  }

  return (
    <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#FFF3EC] text-[#5B342C]">
      <CalendarClock size={22} />
    </div>
  );
}

function FinancialPackageThumb({ row, resource, onOpenGallery }: { row: Row; resource: ResourceKey; onOpenGallery: (row: Row, index: number) => void }) {
  const image = financialPackageImage(row);
  if (!image) return null;

  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onOpenGallery(row, financialPackageImageIndex(row, resource));
      }}
      className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl border border-[#F4C7C4] bg-[#FFF3EC] shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
      aria-label="Xem ảnh"
    >
      <img src={image} alt="" className="h-full w-full object-cover" />
      <span className="absolute bottom-0 left-0 right-0 bg-white/92 px-1 py-0.5 text-center text-[9px] font-black text-[#A84E61] shadow-sm">
        Gói chụp
      </span>
    </button>
  );
}

const GroupBookingCard = memo(function GroupBookingCard({
  row,
  resource,
  indexLabel,
  selected,
  selectionMode,
  canRemove,
  onToggleSelect,
  onDelete,
  onOpenDetail,
}: {
  row: Row;
  resource: ResourceKey;
  indexLabel: number;
  selected: boolean;
  selectionMode: boolean;
  canRemove: boolean;
  onToggleSelect: (id: string) => void;
  onDelete: (row: Row) => void;
  onOpenDetail: (row: Row) => void;
}) {
  const group = groupBookingSnapshotFromRow(row);
  const [expanded, setExpanded] = useState(false);
  const [preview, setPreview] = useState<{ images: string[]; index: number; alt: string } | null>(null);
  const [detail, setDetail] = useState<GroupBookingCustomerSnapshot | null>(null);
  if (!group) return null;
  const id = String(row.id ?? group.id);
  const canPrint = ["transactions", "invoices", "wallets"].includes(resource);
  const groupTheme = String(row.type ?? "") === "INCOME"
    ? { card: "border-emerald-400 bg-gradient-to-br from-emerald-50 via-white to-emerald-100 shadow-[0_14px_38px_-14px_rgba(5,150,105,0.45)] ring-1 ring-emerald-200/80", badge: "border-emerald-700 bg-emerald-600 text-white" }
    : String(row.type ?? "") === "EXPENSE"
      ? { card: "border-red-400 bg-gradient-to-br from-red-50 via-white to-red-100 shadow-[0_14px_38px_-14px_rgba(220,38,38,0.45)] ring-1 ring-red-200/80", badge: "border-red-700 bg-red-600 text-white" }
      : resource === "projects"
        ? { card: "border-purple-400 bg-gradient-to-br from-purple-50 via-white to-purple-100 shadow-[0_14px_38px_-14px_rgba(126,34,206,0.45)] ring-1 ring-purple-200/80", badge: "border-purple-700 bg-purple-600 text-white" }
        : resource === "invoices"
          ? { card: "border-amber-400 bg-gradient-to-br from-amber-50 via-white to-yellow-100 shadow-[0_14px_38px_-14px_rgba(217,119,6,0.45)] ring-1 ring-amber-200/80", badge: "border-amber-600 bg-amber-500 text-white" }
          : { card: "border-[#F4C7C4] bg-white shadow-sm", badge: "border-[#F4C7C4] bg-white text-[#A84E61]" };

  return (
    <>
      <Card
        data-row-id={id}
        className={cn(
          "relative mt-6 rounded-[1.5rem] border p-4 transition",
          selected ? "border-[#EA7188] bg-[#FFF0F4] ring-2 ring-[#EA7188]/30" : groupTheme.card,
        )}
      >
        <div className="absolute -top-3 left-5 flex gap-1.5">
          <span className={cn("rounded-full border px-3 py-1 text-[11px] font-black shadow-sm", groupTheme.badge)}>
            {formatDateTimeLabel(group.paymentInfo?.paidAt || group.createdAt || row.createdAt)}
          </span>
          <span className={cn("rounded-full border px-3 py-1 text-[11px] font-black shadow-sm", groupTheme.badge)}>
            Booking nhóm
          </span>
        </div>
        <button
          type="button"
          className="flex w-full items-center justify-between gap-3 pt-2 text-left"
          onClick={() => setExpanded((value) => !value)}
        >
          <div className="flex min-w-0 items-center gap-3">
            {canRemove && (selectionMode || selected) ? (
              <span
                role="checkbox"
                aria-checked={selected}
                onClick={(event) => {
                  event.stopPropagation();
                  onToggleSelect(id);
                }}
                className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl border text-[12px] font-black", selected ? "border-[#EA7188] bg-[#EA7188] text-white" : "border-[#F4C7C4] bg-white text-[#EA7188]")}
              >
                {selected ? "✓" : ""}
              </span>
            ) : (
              <OrderBadge value={indexLabel} />
            )}
            <div className="min-w-0">
              <h2 className="truncate text-lg font-black leading-tight text-[#5B342C]">{group.groupName}</h2>
              <p className="mt-1 truncate text-sm font-bold text-[#9B746B]">
                {group.customers.length} khách · {groupInvoiceCode(group)}
              </p>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <p className={cn("text-base font-black", financialMoneyTone(resource, row))}>{formatMoney(group.totalAmount)}</p>
            <p className="text-[10px] font-bold text-[#9B746B]">{expanded ? "Thu gọn" : "Xem"}</p>
          </div>
        </button>

        <div className="mt-4 flex flex-wrap justify-end gap-2">
          {canPrint ? (
            <Button variant="secondary" size="sm" className="rounded-2xl" onClick={(event) => { event.stopPropagation(); printGroupInvoice(group); }}>
              <Printer size={15} /> In hóa đơn tổng
            </Button>
          ) : null}
          {canRemove ? (
            <Button variant="danger" size="icon" className="h-10 w-10 rounded-2xl" aria-label="Xóa dữ liệu" onClick={(event) => { event.stopPropagation(); onDelete(row); }}>
              <Trash2 size={16} />
            </Button>
          ) : null}
        </div>

        {expanded ? (
          <div className="mt-3 grid gap-2">
            {group.customers.map((customer, customerIdx) => {
              const images = (customer.packageImages?.length ? customer.packageImages : customer.packageImage ? [customer.packageImage] : []).filter(Boolean) as string[];
              const customerInitial = customer.customerName.trim().charAt(0).toUpperCase() || "K";
              const avatarGradients = [
                "from-[#EA7188] to-[#D94F73]",
                "from-violet-500 to-purple-600",
                "from-sky-500 to-blue-600",
                "from-amber-500 to-orange-600",
                "from-emerald-500 to-teal-600",
                "from-rose-500 to-pink-600",
                "from-cyan-500 to-blue-500",
                "from-fuchsia-500 to-purple-600",
              ];
              const avatarGradient = avatarGradients[customerIdx % avatarGradients.length];
              return (
                <div
                  key={customer.id}
                  className="relative mt-4 cursor-pointer rounded-[1.5rem] border border-emerald-300 bg-gradient-to-br from-emerald-50/60 via-white to-emerald-50/40 p-3.5 shadow-sm ring-1 ring-emerald-200/50 transition hover:-translate-y-0.5 hover:shadow-md active:scale-[0.99]"
                  onClick={() => setDetail(customer)}
                >
                  {/* Top badges */}
                  <div className="absolute -top-2.5 left-4 flex gap-1.5">
                    <span className="rounded-full border border-emerald-600 bg-emerald-600 px-2.5 py-0.5 text-[10px] font-black text-white shadow-sm">
                      {customer.status || "COMPLETED"}
                    </span>
                  </div>

                  {/* Main row: avatar + info + price */}
                  <div className="flex items-start justify-between gap-3 pt-1">
                    <div className="flex min-w-0 items-center gap-2.5">
                      {/* Avatar */}
                      <span className={`relative grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-[0.85rem] shadow-sm ${customer.customerImage ? "" : `bg-gradient-to-br ${avatarGradient}`}`}>
                        {customer.customerImage ? (
                          <img src={customer.customerImage} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <span className="text-[15px] font-black text-white drop-shadow-sm">{customerInitial}</span>
                        )}
                      </span>
                      <div className="min-w-0">
                        <h3 className="truncate text-base font-black leading-tight text-[#5B342C]">{customer.customerName}</h3>
                        <div className="mt-0.5 flex items-center gap-1.5">
                          <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                          <p className="truncate text-sm font-bold text-[#9B746B]">{customer.packageName}</p>
                        </div>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-base font-black text-emerald-700">{formatMoney(customer.totalAmount)}</p>
                      <p className="text-[10px] font-bold text-[#9B746B]">Thanh toán</p>
                    </div>
                  </div>

                  {/* Bottom: package thumb + actions */}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {images[0] ? (
                      <button
                        type="button"
                        className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#F4C7C4] bg-white p-0.5 shadow-sm"
                        onClick={(event) => {
                          event.stopPropagation();
                          setPreview({ images, index: 0, alt: customer.packageName });
                        }}
                      >
                        <img src={images[0]} alt="" className="max-h-full max-w-full object-contain" />
                        <span className="absolute bottom-0.5 left-0.5 right-0.5 rounded-full bg-white/95 px-1 py-0.5 text-[8px] font-black text-[#A84E61] shadow-sm">Gói chụp</span>
                      </button>
                    ) : null}
                    <div className="flex flex-1 justify-end gap-2">
                      {canPrint ? (
                        <Button variant="secondary" size="icon" className="h-9 w-9 shrink-0 rounded-xl" aria-label="In bill"
                          onClick={(event) => { event.stopPropagation(); printGroupCustomerBill(group, customer); }}
                        >
                          <Printer size={15} className="text-[#EA7188]" />
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </Card>

      {detail ? (
        <Portal>
          <div className="fixed inset-0 z-[160] flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-sm" onClick={() => setDetail(null)}>
            <div className="w-full max-w-lg rounded-[1.75rem] border border-[#F4C7C4] bg-white p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-black uppercase text-[#EA7188]">{group.groupName}</p>
                  <h3 className="mt-1 truncate text-xl font-black text-[#5B342C]">{detail.customerName}</h3>
                </div>
                <Button variant="secondary" size="icon" className="rounded-2xl" onClick={() => setDetail(null)}><X size={16} /></Button>
              </div>
              <div className="mt-4 grid gap-2 text-sm font-bold text-[#6E514A]">
                <div className="rounded-2xl bg-[#FFF8F1] p-3">Gói: {detail.packageName}</div>
                <div className="rounded-2xl bg-[#FFF8F1] p-3">Mã đơn: {detail.invoiceCode}</div>
                <div className="rounded-2xl bg-[#FFF8F1] p-3">Thanh toán: {formatMoney(detail.totalAmount)}</div>
                <div className="rounded-2xl bg-[#FFF8F1] p-3">Phương thức: {group.paymentInfo?.paymentMethod || group.paymentMethod || "CASH"}</div>
              </div>
              {detail.packageImages?.length ? (
                <div className="mt-4 flex gap-2 overflow-x-auto">
                  {detail.packageImages.map((image, index) => (
                    <button key={`${image}-${index}`} type="button" className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-[#F4C7C4]" onClick={() => setPreview({ images: detail.packageImages ?? [], index, alt: detail.packageName })}>
                      <img src={image} alt="" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              ) : null}
              <div className="mt-4 flex justify-end gap-2">
                {canPrint ? <Button variant="secondary" onClick={() => printGroupCustomerBill(group, detail)}><Printer size={15} /> In bill</Button> : null}
                <Button onClick={() => onOpenDetail(row)}>Xem nguồn</Button>
              </div>
            </div>
          </div>
        </Portal>
      ) : null}

      {preview ? (
        <ImagePreview
          images={preview.images}
          index={preview.index}
          alt={preview.alt}
          onIndexChange={(index) => setPreview((current) => current ? { ...current, index } : current)}
          onClose={() => setPreview(null)}
        />
      ) : null}
    </>
  );
});

const FinancialCompactCard = memo(function FinancialCompactCard({
  row,
  resource,
  indexLabel,
  selected,
  selectionMode,
  canEdit,
  canRemove,
  onToggleSelect,
  onEdit,
  onDelete,
  onOpenDetail,
  onOpenGallery,
  focused,
}: {
  row: Row;
  resource: ResourceKey;
  indexLabel: number;
  selected: boolean;
  selectionMode: boolean;
  canEdit: boolean;
  canRemove: boolean;
  onToggleSelect: (id: string) => void;
  onEdit: (row: Row) => void;
  onDelete: (row: Row) => void;
  onOpenDetail: (row: Row) => void;
  onOpenGallery: (row: Row, index: number) => void;
  focused?: boolean;
}) {
  const longPressTimer = useRef<number | null>(null);
  const [longPressActivated, setLongPressActivated] = useState(false);
  const groupBooking = groupBookingSnapshotFromRow(row);
  const id = String(row.id ?? "");
  const invoice = printableInvoiceData(row);
  const isTransaction = resource === "transactions";
  const isIncome = String(row.type ?? "") === "INCOME";
  const title = invoice.customerName && invoice.customerName !== "Khách hàng"
    ? invoice.customerName
    : String(row.customerName ?? row.title ?? row.name ?? "Khách hàng");
  const packageName = invoice.packageName || String(row.packageName ?? row.title ?? "Gói dịch vụ");
  const amount = invoice.amount ?? row.amount ?? row.total ?? 0;

  function clearLongPress() {
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  function startLongPress(event: React.PointerEvent) {
    const target = event.target as HTMLElement;
    const currentTarget = event.currentTarget as HTMLElement;
    if (!canRemove || (target !== currentTarget && target.closest("button,a,input,select,textarea"))) return;
    longPressTimer.current = window.setTimeout(() => {
      onToggleSelect(id);
      setLongPressActivated(true);
      longPressTimer.current = null;
    }, 520);
  }

  const theme = useMemo(() => {
    if (isTransaction) {
      if (isIncome) {
        return {
          card: "border-emerald-400 bg-gradient-to-br from-emerald-50 via-white to-emerald-100 shadow-[0_14px_38px_-14px_rgba(5,150,105,0.45)] ring-1 ring-emerald-200/80",
          badge: "bg-emerald-600 border-emerald-700 text-white",
          money: "text-emerald-700",
        };
      }
      return {
        card: "border-red-400 bg-gradient-to-br from-red-50 via-white to-red-100 shadow-[0_14px_38px_-14px_rgba(220,38,38,0.45)] ring-1 ring-red-200/80",
        badge: "bg-red-600 border-red-700 text-white",
        money: "text-red-700",
      };
    }
    if (resource === "projects") {
      return {
        card: "border-purple-400 bg-gradient-to-br from-purple-50 via-white to-purple-100 shadow-[0_14px_38px_-14px_rgba(126,34,206,0.45)] ring-1 ring-purple-200/80",
        badge: "bg-purple-600 border-purple-700 text-white",
        money: "text-purple-700",
      };
    }
    if (resource === "invoices") {
      return {
        card: "border-amber-400 bg-gradient-to-br from-amber-50 via-white to-yellow-100 shadow-[0_14px_38px_-14px_rgba(217,119,6,0.45)] ring-1 ring-amber-200/80",
        badge: "bg-amber-500 border-amber-600 text-white",
        money: "text-amber-700",
      };
    }
    return {
      card: "border-[#F4C7C4] bg-white",
      badge: "bg-[#FFF0F4] border-[#F4C7C4] text-[#C14F69]",
      money: "text-[#5B342C]",
    };
  }, [isTransaction, isIncome, resource]);

  if (groupBooking) {
    return (
      <GroupBookingCard
        row={row}
        resource={resource}
        indexLabel={indexLabel}
        selected={selected}
        selectionMode={selectionMode}
        canRemove={canRemove}
        onToggleSelect={onToggleSelect}
        onDelete={onDelete}
        onOpenDetail={onOpenDetail}
      />
    );
  }

  return (
    <Card
      data-row-id={id}
      onClick={() => {
        if (longPressActivated) {
          setLongPressActivated(false);
          return;
        }
        onOpenDetail(row);
      }}
      onPointerDown={startLongPress}
      onPointerUp={clearLongPress}
      onPointerCancel={clearLongPress}
      onPointerLeave={clearLongPress}
      className={cn(
        "relative mt-6 cursor-pointer rounded-[1.75rem] p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md active:scale-[0.99]",
        theme.card,
        focused ? "ring-2 ring-[#EA7188]" : "",
      )}
    >
      <div className="absolute -top-3 left-5 flex gap-1.5">
        <span className={cn("rounded-full border px-3 py-1 text-[11px] font-black shadow-sm", theme.badge)}>
          {formatDateTimeLabel(row.occurredAt ?? row.issueDate ?? row.deadlineAt ?? row.createdAt)}
        </span>
        {isTransaction ? (
          <span className={cn("rounded-full border px-3 py-1 text-[11px] font-black shadow-sm", theme.badge)}>
            {isIncome ? "Khoản thu" : "Khoản chi"}
          </span>
        ) : (
          <>
            {resource === "projects" && <span className={cn("rounded-full border px-3 py-1 text-[11px] font-black shadow-sm", theme.badge)}>Dự án</span>}
            {resource === "invoices" && <span className={cn("rounded-full border px-3 py-1 text-[11px] font-black shadow-sm", theme.badge)}>Hóa đơn</span>}
          </>
        )}
      </div>

      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {canRemove && (selectionMode || selected) ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onToggleSelect(id);
              }}
              className={cn(
                "grid h-9 w-9 shrink-0 place-items-center rounded-xl border text-[12px] font-black transition",
                selected ? "border-[#EA7188] bg-[#EA7188] text-white shadow-[0_0_0_4px_rgba(234,113,136,0.18)] scale-105" : "border-[#F4C7C4] bg-white text-[#EA7188]",
              )}
              aria-label="Chọn mục"
            >
              {selected ? "✓" : ""}
            </button>
          ) : (
            <OrderBadge value={indexLabel} />
          )}
          <FinancialCustomerAvatar row={row} resource={resource} />
          <div className="min-w-0">
            <h2 className="whitespace-normal break-words text-lg font-black leading-tight text-[#5B342C]">{title}</h2>
            <div className="mt-1 flex items-center gap-1.5">
              <div className={cn("h-1.5 w-1.5 shrink-0 rounded-full", isIncome ? "bg-emerald-500" : "bg-rose-500")} />
              <p className="truncate text-sm font-bold text-[#9B746B]">{packageName}</p>
            </div>
          </div>
        </div>

        <div className="shrink-0 text-right">
          <p className={cn("text-base font-black", financialMoneyTone(resource, row))}>
            {financialAmountPrefix(row)}{formatMoney(amount as string | number | null | undefined)}
          </p>
          <p className="text-[10px] font-bold text-[#9B746B]">{resource === "projects" ? "Dự án" : "Thanh toán"}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <FinancialPackageThumb row={row} resource={resource} onOpenGallery={onOpenGallery} />
        <div className="flex flex-1 justify-end gap-2">
          {["invoices", "transactions"].includes(resource) ? <PrintInvoiceMenu row={row} /> : null}
          {canEdit ? (
            <Button variant="secondary" size="icon" className="h-10 w-10 shrink-0 rounded-2xl" aria-label="Sửa dữ liệu" onClick={(event) => { event.stopPropagation(); onEdit(row); }}>
              <Pencil size={16} className="text-[#EA7188]" />
            </Button>
          ) : null}
          {canRemove ? (
            <Button variant="danger" size="icon" className="h-10 w-10 shrink-0 rounded-2xl" aria-label="Xóa dữ liệu" onClick={(event) => { event.stopPropagation(); onDelete(row); }}>
              <Trash2 size={16} />
            </Button>
          ) : null}
        </div>
      </div>
    </Card>
  );
});

export function ResourceManager({ resource }: { resource: ResourceKey }) {
  const config = getConfig(resource);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const setActiveResource = useUiStore((state) => state.setActiveResource);
  const focusedItemId = useUiStore((state) => state.focusedItemId);
  const setFocusedItemId = useUiStore((state) => state.setFocusedItemId);
  const transactionViewIntent = useUiStore((state) => state.transactionViewIntent);
  const setTransactionIntent = useUiStore((state) => state.setTransactionIntent);
  const setTransactionViewIntent = useUiStore((state) => state.setTransactionViewIntent);
  const session = useUiStore((state) => state.session);
  const [rows, setRows] = useState<Row[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMoreRows, setHasMoreRows] = useState(false);
  const [loadingMoreRows, setLoadingMoreRows] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [form, setForm] = useState<Row>(() => emptyForm(config.fields));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string>("");
  const [deleteTarget, setDeleteTarget] = useState<Row | null>(null);
  const [preview, setPreview] = useState<{ images: string[]; index: number; alt: string } | null>(null);
  const [detailRow, setDetailRow] = useState<Row | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [query, setQuery] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [dateFilterOpen, setDateFilterOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkDeleteMode, setBulkDeleteMode] = useState<"selected" | "all" | null>(null);
  const [transactionView, setTransactionView] = useState<TransactionView>(null);
  const [walletRows, setWalletRows] = useState<Row[]>([]);
  const [walletTransactions, setWalletTransactions] = useState<Row[]>([]);
  const [longPressTimer, setLongPressTimer] = useState<number | null>(null);
  const [longPressActivated, setLongPressActivated] = useState(false);
  const [editStudioPassword, setEditStudioPassword] = useState("");
  const [editingSystemNote, setEditingSystemNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);
  
  useEffect(() => {
    if (showForm || !!detailRow) {
      document.body.classList.add("studio-modal-open");
    } else {
      document.body.classList.remove("studio-modal-open");
    }
    return () => document.body.classList.remove("studio-modal-open");
  }, [showForm, detailRow]);

  const endpoint = `/api/resources/${resource}`;
  const title = useMemo(() => (editingId ? `Cập nhật ${config.shortLabel}` : `Thêm ${config.shortLabel}`), [config.shortLabel, editingId]);
  const groupedFields = useMemo(() => splitFields(config.fields), [config.fields]);
  const transactionTabParam = searchParams.get("tab");
  const urlTransactionView: TransactionView = resource === "transactions" && (transactionTabParam === "income" || transactionTabParam === "expense") ? transactionTabParam : null;

  function clearLongPress() {
    if (longPressTimer) {
      window.clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  }

  function goToResource(id: string) {
    setActiveResource(id);
    navigateStudioView(router, pathname, id);
  }

  function startRowLongPress(event: React.PointerEvent, row: Row) {
    const target = event.target as HTMLElement;
    const currentTarget = event.currentTarget as HTMLElement;
    if (event.pointerType === "touch" && (event.clientX < 28 || event.clientX > window.innerWidth - 28)) return;
    if (!canDelete(session) || (target !== currentTarget && target.closest("button,a,input,select,textarea"))) return;
    const id = String(row.id ?? "");
    const timer = window.setTimeout(() => {
      setSelectedIds((current) => current.includes(id) ? current : [...current, id]);
      setLongPressActivated(true);
      setLongPressTimer(null);
    }, 520);
    setLongPressTimer(timer);
  }

  const loadRows = useCallback(async (mode: "reset" | "append" = "reset", cursor?: string | null) => {
    if (mode === "append" && !cursor) return;
    setLoadingMoreRows(mode === "append");

    const url = `${endpoint}?${new URLSearchParams({ take: "50", cursorMode: "1", ...(mode === "append" && cursor ? { cursor } : {}) }).toString()}`;

    // On reset: try to show cached data instantly while fetching fresh
    if (mode === "reset") {
      try {
        const cached = sessionStorage.getItem(`rc:${endpoint}`);
        if (cached) {
          const page = JSON.parse(cached) as PaginatedRows;
          setRows(page.items);
          setNextCursor(page.nextCursor);
          setHasMoreRows(page.hasMore);
          // Don't show spinner if we have cache — just silently refresh
        } else {
          setInitialLoading(true);
        }
      } catch {
        setInitialLoading(true);
      }
    }

    const res = await fetch(url);
    const payload = await res.json();
    if (payload.data) {
      const page = payload.data as PaginatedRows | Row[];
      const items = Array.isArray(page) ? page : page.items;
      setRows((current) => {
        if (mode === "reset") return items;
        const seen = new Set(current.map((row) => String(row.id ?? "")));
        return [...current, ...items.filter((row) => !seen.has(String(row.id ?? "")))];
      });
      const nextCursorValue = Array.isArray(page) ? null : page.nextCursor;
      const hasMore = Array.isArray(page) ? false : page.hasMore;
      setNextCursor(nextCursorValue);
      setHasMoreRows(hasMore);
      // Cache the first page for instant display next time
      if (mode === "reset") {
        try {
          sessionStorage.setItem(`rc:${endpoint}`, JSON.stringify({ items, nextCursor: nextCursorValue, hasMore }));
        } catch { /* storage full — ignore */ }
      }
    }
    if (payload.error && !/chưa đăng nhập/i.test(payload.error.message)) setMessage(payload.error.message);
    setLoadingMoreRows(false);
    setInitialLoading(false);
  }, [endpoint]);

  const loadWalletRows = useCallback(async () => {
    if (resource !== "transactions") return;
    const res = await fetch("/api/resources/wallets?take=100").catch(() => null);
    const payload = await res?.json().catch(() => null);
    if (payload?.data) setWalletRows(payload.data);
  }, [resource]);

  const loadWalletTransactions = useCallback(async () => {
    if (resource !== "wallets") return;
    const res = await fetch("/api/resources/transactions?take=100").catch(() => null);
    const payload = await res?.json().catch(() => null);
    if (payload?.data) setWalletTransactions(payload.data);
  }, [resource]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const pendingTransactionIntent = useUiStore.getState().transactionIntent;
      const pendingTransactionViewIntent = useUiStore.getState().transactionViewIntent;
      const hasTransactionIntent = resource === "transactions" && pendingTransactionIntent;
      const hasTransactionViewIntent = resource === "transactions" && pendingTransactionViewIntent;
      const nextType = pendingTransactionIntent === "income" ? "INCOME" : pendingTransactionIntent === "expense" ? "EXPENSE" : "";
      setRows([]);
      setNextCursor(null);
      setHasMoreRows(false);
      setForm(hasTransactionIntent ? { ...emptyForm(config.fields), type: nextType, walletId: "" } : emptyForm(config.fields));
      setEditingId(null);
      setEditingSystemNote("");
      setShowForm(Boolean(hasTransactionIntent));
      setSelectedIds([]);
      setBulkDeleteMode(null);
      setTransactionView(hasTransactionIntent ? pendingTransactionIntent : hasTransactionViewIntent ? pendingTransactionViewIntent : urlTransactionView);
      setMessage("");
      setWalletTransactions([]);
      void loadRows();
      void loadWalletRows();
      void loadWalletTransactions();
      if (hasTransactionIntent) setTransactionIntent(null);
      if (hasTransactionViewIntent) setTransactionViewIntent(null);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [resource, config.fields, loadRows, loadWalletRows, loadWalletTransactions, setTransactionIntent, setTransactionViewIntent, urlTransactionView]);

  useEffect(() => {
    if (resource !== "transactions" || !transactionViewIntent) return;
    const timer = window.setTimeout(() => {
      setTransactionView(transactionViewIntent);
      setShowForm(false);
      setEditingId(null);
      setEditingSystemNote("");
      setSelectedIds([]);
      setBulkDeleteMode(null);
      setTransactionViewIntent(null);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [resource, transactionViewIntent, setTransactionViewIntent]);

  useEffect(() => {
    if (!focusedItemId || !rows.length) return;
    const timer = window.setTimeout(() => {
      if (resource === "transactions" && !transactionView) {
        const focusedRow = rows.find((row) => String(row.id ?? "") === focusedItemId);
        const nextView = String(focusedRow?.type ?? "") === "EXPENSE" ? "expense" : String(focusedRow?.type ?? "") === "INCOME" ? "income" : null;
        if (nextView) setTransactionView(nextView);
      }
      window.setTimeout(() => {
      const element = document.querySelector(`[data-row-id="${CSS.escape(focusedItemId)}"]`);
      element?.scrollIntoView({ behavior: "smooth", block: "center" });
      element?.classList.add("studio-focus-highlight");
      window.setTimeout(() => {
        element?.classList.remove("studio-focus-highlight");
        setFocusedItemId(null);
      }, 2800);
      }, resource === "transactions" && !transactionView ? 120 : 0);
    }, 80);
    return () => window.clearTimeout(timer);
  }, [focusedItemId, resource, rows, setFocusedItemId, transactionView]);


  async function save() {
    setSubmitting(true);
    try {
      const payload: Row = { ...form, ...(editingId ? { id: editingId } : {}) };
      if (editingId && "note" in payload) payload.note = mergeSystemNote(payload.note, editingSystemNote);
      if (editingId && session?.user.role === "STAFF") payload.studioPassword = editStudioPassword;
      if (resource === "transactions" && !payload.walletId) {
        setMessage("Vui lòng chọn ví để biết tiền đi vào hoặc đi ra từ đâu.");
        setSubmitting(false);
        return;
      }
      const res = await fetch(endpoint, {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (result.error) {
        setMessage(result.error.message);
        setSubmitting(false);
        return;
      }
      setMessage(editingId ? "Đã cập nhật dữ liệu." : "Đã tạo dữ liệu mới.");
      setForm(emptyForm(config.fields));
      setEditingId(null);
      setEditStudioPassword("");
      setEditingSystemNote("");
      setShowForm(false);
      void loadRows();
    } finally {
      setSubmitting(false);
    }
  }

  async function remove(row: Row, mode: "trash" | "hard") {
    const studioPassword = session?.user.role === "MANAGER" ? window.prompt("Nhập mật khẩu xóa ca 6 số để xóa dữ liệu.")?.trim() ?? "" : "";
    if (session?.user.role === "MANAGER" && !/^\d{6}$/.test(studioPassword)) {
      setMessage("Mật khẩu xóa ca phải gồm 6 số.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(endpoint, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: row.id, mode, ...(studioPassword ? { studioPassword } : {}) }),
      });
      const result = await res.json();
      if (result.error) {
        setMessage(result.error.message);
        setSubmitting(false);
        return;
      }
      setDeleteTarget(null);
      setSelectedIds((current) => current.filter((id) => id !== String(row.id ?? "")));
      setMessage(mode === "hard" ? "Đã xóa vĩnh viễn dữ liệu." : "Đã chuyển dữ liệu vào thùng rác.");
      await loadRows();
    } finally {
      setSubmitting(false);
    }
  }

  async function removeMany(rowsToDelete: Row[], mode: "trash" | "hard") {
    const studioPassword = session?.user.role === "MANAGER" ? window.prompt("Nhập mật khẩu xóa ca 6 số để xóa dữ liệu.")?.trim() ?? "" : "";
    if (session?.user.role === "MANAGER" && !/^\d{6}$/.test(studioPassword)) {
      setMessage("Mật khẩu xóa ca phải gồm 6 số.");
      return;
    }
    setSubmitting(true);
    try {
      for (const row of rowsToDelete) {
        const res = await fetch(endpoint, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: row.id, mode, ...(studioPassword ? { studioPassword } : {}) }),
        });
        const result = await res.json();
        if (result.error) {
          setMessage(result.error.message);
          setBulkDeleteMode(null);
          setSubmitting(false);
          return;
        }
      }
      setMessage(mode === "hard" ? `Đã xóa ${rowsToDelete.length} mục.` : `Đã chuyển ${rowsToDelete.length} mục vào thùng rác.`);
      setSelectedIds([]);
      setBulkDeleteMode(null);
      await loadRows();
    } finally {
      setSubmitting(false);
    }
  }

  function edit(row: Row) {
    let studioPassword = "";
    if (session?.user.role === "STAFF") {
      studioPassword = window.prompt("Nhập mật khẩu studio 6 số để sửa dữ liệu.")?.trim() ?? "";
      if (!/^\d{6}$/.test(studioPassword)) {
        setMessage("Nhân viên cần nhập đúng mật khẩu studio 6 số để sửa dữ liệu.");
        return;
      }
    }
    const next = emptyForm(config.fields);
    for (const field of config.fields) next[field.key] = field.key === "note" ? editableNoteValue(row) : row[field.key] ?? "";
    setForm(next);
    setEditingId(String(row.id));
    setEditStudioPassword(studioPassword);
    setEditingSystemNote(extractSystemNote(row.note));
    setShowForm(true);
  }

  function chooseTransactionView(view: Exclude<TransactionView, null>) {
    const type = view === "income" ? "INCOME" : "EXPENSE";
    const firstWalletId = String(walletRows[0]?.id ?? "");
    setTransactionView(view);
    setQuery("");
    setSelectedIds([]);
    setBulkDeleteMode(null);
    setEditingId(null);
    setShowForm(false);
    setEditingSystemNote("");
    setForm({ ...emptyForm(config.fields), type, walletId: firstWalletId });
    navigateStudioView(router, pathname, "transactions", { tab: view });
  }

  function openCreateForm() {
    const next = emptyForm(config.fields);
    if (resource === "transactions" && transactionView) {
      next.type = transactionView === "income" ? "INCOME" : "EXPENSE";
      next.walletId = String(walletRows[0]?.id ?? "");
    }
    setEditingId(null);
    setEditStudioPassword("");
    setEditingSystemNote("");
    setForm(next);
    setShowForm(true);
  }

  function openRowGallery(row: Row, index: number) {
    const images = rowImages(row, config.imageField);
    if (!images.length) return;
    setPreview({ images, index, alt: String(row[config.primaryField] ?? config.label) });
  }

  async function moveBooking(row: Row, targetDate: Date) {
    const start = row.startAt ? new Date(String(row.startAt)) : new Date();
    const end = row.endAt ? new Date(String(row.endAt)) : new Date(start.getTime() + 60 * 60 * 1000);
    const duration = end.getTime() - start.getTime();
    const nextStart = new Date(targetDate);
    nextStart.setHours(start.getHours(), start.getMinutes(), 0, 0);
    const nextEnd = new Date(nextStart.getTime() + duration);
    await fetch(endpoint, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...row, startAt: nextStart.toISOString(), endAt: nextEnd.toISOString() }),
    });
    void loadRows();
  }

  const deferredQuery = useDeferredValue(query);
  const deferredFromDate = useDeferredValue(fromDate);
  const deferredToDate = useDeferredValue(toDate);

  const filteredRows = useMemo(() => {
    const keyword = deferredQuery.trim().toLowerCase();
    const dateFilteredRows = ["transactions", "invoices", "projects"].includes(resource)
      ? rows.filter((row) => dateInRange(
          resource === "transactions" ? row.occurredAt ?? row.createdAt : resource === "projects" ? row.deadlineAt ?? row.createdAt : row.issueDate ?? row.createdAt,
          deferredFromDate,
          deferredToDate,
        ))
      : rows;
    if (!keyword) return dateFilteredRows;
    return dateFilteredRows.filter((row) => Object.values(row).some((value) => String(value ?? "").toLowerCase().includes(keyword)));
  }, [deferredFromDate, deferredQuery, resource, rows, deferredToDate]);
  const transactionType = transactionView === "income" ? "INCOME" : transactionView === "expense" ? "EXPENSE" : null;
  const visibleRows = resource === "transactions" && transactionType ? filteredRows.filter((row) => String(row.type) === transactionType) : filteredRows;
  const walletById = useMemo(() => new Map(walletRows.map((wallet) => [String(wallet.id), wallet])), [walletRows]);
  const detailWalletById = useMemo(() => {
    if (resource === "wallets") return new Map(visibleRows.map((wallet) => [String(wallet.id), wallet]));
    return walletById;
  }, [resource, visibleRows, walletById]);
  const incomeCount = rows.filter((row) => String(row.type) === "INCOME").length;
  const expenseCount = rows.filter((row) => String(row.type) === "EXPENSE").length;
  const allVisibleSelected = visibleRows.length > 0 && visibleRows.every((row) => selectedIds.includes(String(row.id ?? "")));
  const bulkRows = bulkDeleteMode === "all" ? visibleRows : visibleRows.filter((row) => selectedIds.includes(String(row.id ?? "")));

  const groupedSourceRows = resource === "transactions" ? visibleRows : rows;

  const _rowGroups = resource === "transactions"
    ? [
        { title: "Khoản thu", tone: "border-emerald-100 bg-emerald-50 text-emerald-700", rows: groupedSourceRows.filter((row) => String(row.type) === "INCOME") },
        { title: "Khoản chi", tone: "border-rose-100 bg-rose-50 text-rose-700", rows: groupedSourceRows.filter((row) => String(row.type) === "EXPENSE") },
        { title: "Chuyển khoản", tone: "border-violet-100 bg-violet-50 text-violet-700", rows: groupedSourceRows.filter((row) => String(row.type) === "TRANSFER") },
      ].filter((group) => group.rows.length > 0)
    : [{ title: "", tone: "", rows: visibleRows }];
  void _rowGroups;

  const transactionDayGroups = useMemo(() => {
    const groups = new Map<string, Row[]>();
    for (const row of visibleRows) {
      const key = formatDayLabel(row.occurredAt ?? row.createdAt);
      groups.set(key, [...(groups.get(key) ?? []), row]);
    }
    return Array.from(groups.entries()).map(([date, groupRows]) => ({ date, rows: groupRows }));
  }, [visibleRows]);

  if (resource === "transactions" && !transactionView) {
    return (
      <div className="mx-auto max-w-[1100px] space-y-4 sm:space-y-6">
        <StudioBrandPanel
          eyebrow="Tài chính"
          title="Thu chi"
          description="Chọn loại giao dịch cần xem để danh sách gọn hơn, dễ kiểm tra hơn trên điện thoại."
        />

        <AlertModal isOpen={!!message} message={message} onClose={() => setMessage("")} />

        <div className="grid grid-cols-2 gap-2 sm:gap-4">
          <button
            type="button"
            onClick={() => chooseTransactionView("income")}
            className="group rounded-[1.5rem] border border-emerald-200 bg-white p-3 text-left shadow-[0_18px_45px_rgba(22,163,74,0.08)] transition hover:-translate-y-1 hover:shadow-[0_22px_55px_rgba(22,163,74,0.16)] sm:rounded-[2rem] sm:p-7"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-2xl bg-emerald-50 text-xl font-black text-emerald-600 sm:h-14 sm:w-14 sm:text-2xl">+</div>
              <span className="rounded-full bg-emerald-50 px-4 py-2 text-sm font-black text-emerald-700">
                {initialLoading ? (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" style={{ animationDelay: "150ms" }} />
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" style={{ animationDelay: "300ms" }} />
                  </span>
                ) : `${incomeCount} mục`}
              </span>
            </div>
            <h2 className="mt-5 text-2xl font-black text-[#5B342C]">Khoản thu</h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-[#8C655E]">Xem tiền khách trả, cọc booking, doanh thu dịch vụ và các khoản tiền vào.</p>
            <div className="mt-5 inline-flex min-h-12 items-center rounded-2xl bg-emerald-600 px-5 text-sm font-black text-white transition group-hover:bg-emerald-700">
              Mở khoản thu
            </div>
          </button>

          <button
            type="button"
            onClick={() => chooseTransactionView("expense")}
            className="group rounded-[1.5rem] border border-rose-200 bg-white p-3 text-left shadow-[0_18px_45px_rgba(244,63,94,0.08)] transition hover:-translate-y-1 hover:shadow-[0_22px_55px_rgba(244,63,94,0.16)] sm:rounded-[2rem] sm:p-7"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-2xl bg-rose-50 text-xl font-black text-rose-600 sm:h-14 sm:w-14 sm:text-2xl">-</div>
              <span className="rounded-full bg-rose-50 px-4 py-2 text-sm font-black text-rose-700">
                {initialLoading ? (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-400" />
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-400" style={{ animationDelay: "150ms" }} />
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-400" style={{ animationDelay: "300ms" }} />
                  </span>
                ) : `${expenseCount} mục`}
              </span>
            </div>
            <h2 className="mt-5 text-2xl font-black text-[#5B342C]">Khoản chi</h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-[#8C655E]">Xem chi lương, mua đồ, thuê ekip, vận hành studio và các khoản tiền ra.</p>
            <div className="mt-5 inline-flex min-h-12 items-center rounded-2xl bg-rose-600 px-5 text-sm font-black text-white transition group-hover:bg-rose-700">
              Mở khoản chi
            </div>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1500px] space-y-4 sm:space-y-6">
      <StudioBrandPanel
        eyebrow={config.group}
        title={config.label}
        description={config.description}
        actions={
          canCreate(session) && resource !== "wallets" ? (
            <Button className="w-full shadow-[0_12px_26px_rgba(234,113,136,0.22)] sm:w-auto" onClick={openCreateForm}>
              <Save size={16} />
              {resource === "transactions" && transactionView === "income" ? "Thêm khoản thu" : resource === "transactions" && transactionView === "expense" ? "Thêm khoản chi" : "Thêm"}
            </Button>
          ) : null
        }
      />
      {resource === "transactions" ? (
        <button
          type="button"
          onClick={() => {
            setTransactionView(null);
            setShowForm(false);
            setEditingId(null);
            setEditingSystemNote("");
            setSelectedIds([]);
            navigateStudioView(router, pathname, "transactions");
          }}
          className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-[#F4C7C4] bg-white px-4 text-sm font-black text-[#5B342C] shadow-sm transition hover:bg-[#FFF3EC]"
        >
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-[#FFF0F4] text-[#EA7188]">
            <Repeat2 size={16} />
          </span>
          Chọn lại thu / chi
        </button>
      ) : null}
      <section className="hidden">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="mb-4 flex w-full max-w-md items-center gap-3 rounded-[1.5rem] border-4 border-[#F7AFC0] bg-white px-4 py-3 shadow-sm sm:mb-5 sm:w-fit sm:rounded-[1.8rem] sm:px-5 sm:py-4">
                <span className="grid h-12 w-12 place-items-center rounded-full bg-[#FFE4EA] text-2xl">🐱</span>
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-[#E88498]">MÈOO XINHH</p>
                  <p className="text-xl font-black leading-none text-[#EA7188] sm:text-2xl">{config.label}</p>
                </div>
                <PawPrint className="hidden text-[#EA7188] sm:block" size={24} />
            </div>
            <p className="text-sm font-bold uppercase tracking-wide text-[#E88498]">{config.group}</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#5B342C] sm:text-3xl">{config.label}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#8C655E]">{config.description}</p>
            <p className="mt-3 hidden rounded-2xl bg-[#FFE4EA] px-4 py-3 text-sm font-medium text-[#74443A] sm:block">{config.workflowHint}</p>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
            {canCreate(session) ? (
              <Button className="w-full shadow-[0_12px_26px_rgba(234,113,136,0.22)] sm:w-auto" onClick={openCreateForm}>
                <Save size={16} />
                Thêm
              </Button>
            ) : (
              <Button variant="secondary" size="icon" aria-label="Đóng form" onClick={() => setShowForm(false)}>
                <X size={16} />
              </Button>
            )}
            {false && config.related.map((target) => (
              <Button key={target} variant="secondary" size="sm" onClick={() => setActiveResource(target)}>
                {RESOURCE_CONFIG[target].label}
                <ArrowRight size={15} />
              </Button>
            ))}
          </div>
        </div>
      </section>

      <AlertModal isOpen={!!message} message={message} onClose={() => setMessage("")} />

      <div className="flex items-center gap-2 rounded-2xl border border-[#F4C7C4] bg-white px-4 py-3 shadow-sm">
        <Search size={18} className="shrink-0 text-[#EA7188]" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={`Tìm kiếm ${config.shortLabel}...`}
          className="h-8 min-w-0 flex-1 bg-transparent text-sm font-semibold text-[#5B342C] outline-none placeholder:text-[#B98278]"
        />
        {query ? (
          <button type="button" className="rounded-full px-2 py-1 text-xs font-black text-[#9B746B] hover:bg-[#FFF3EC]" onClick={() => setQuery("")}>
            Xóa
          </button>
        ) : null}
      </div>

      {resource === "transactions" || resource === "invoices" || resource === "projects" ? (
        <div className="rounded-2xl border border-[#F4C7C4] bg-white px-3 py-2 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setDateFilterOpen((current) => !current)}
              className={`inline-flex h-10 items-center gap-2 rounded-xl px-3 text-sm font-black transition ${fromDate || toDate ? "bg-[#EA7188] text-white shadow-sm" : "bg-[#FFF0F4] text-[#EA7188] hover:bg-[#FFE4EA]"}`}
            >
              <CalendarDays size={16} />
              {fromDate || toDate ? "Đang lọc ngày" : "Lọc ngày"}
            </button>
            {fromDate || toDate ? (
              <div className="flex items-center gap-2 text-xs font-bold text-[#9B746B]">
                <span>{fromDate || "..."}</span>
                <span>-</span>
                <span>{toDate || "..."}</span>
                <button type="button" className="rounded-full bg-[#FFF0F4] px-2 py-1 font-black text-[#EA7188]" onClick={() => { setFromDate(""); setToDate(""); }}>
                  Xóa
                </button>
              </div>
            ) : null}
          </div>
          {dateFilterOpen ? (
            <div className="mt-2 grid gap-2 border-t border-[#F4C7C4] pt-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <label className="text-xs font-black uppercase text-[#B98278]">
                Từ ngày
                <input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} className="mt-1 h-10 w-full rounded-xl border border-[#F1C5C1] bg-[#FFF9F4] px-3 text-sm font-semibold normal-case text-[#5B342C] outline-none" />
              </label>
              <label className="text-xs font-black uppercase text-[#B98278]">
                Đến ngày
                <input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} className="mt-1 h-10 w-full rounded-xl border border-[#F1C5C1] bg-[#FFF9F4] px-3 text-sm font-semibold normal-case text-[#5B342C] outline-none" />
              </label>
              <button type="button" className="h-10 rounded-xl bg-[#FFF0F4] px-3 text-sm font-black text-[#EA7188]" onClick={() => setDateFilterOpen(false)}>
                Xong
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {false && (resource === "transactions" || resource === "invoices" || resource === "projects") ? (
        <div className="grid gap-2 rounded-2xl border border-[#F4C7C4] bg-white px-4 py-3 shadow-sm sm:grid-cols-[1fr_1fr_auto] sm:items-end">
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
      ) : null}

      <div className={canMutate(session) && showForm ? "grid items-start gap-4 xl:grid-cols-[1fr_420px]" : "grid gap-4"}>
        <div className="order-2 space-y-4 xl:order-1">
          {selectedIds.length > 0 && visibleRows.length > 0 && canDelete(session) && resource !== "wallets" ? (
            <div className="flex flex-col gap-2 rounded-2xl border border-[#F4C7C4] bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
              <label className="flex items-center gap-2 text-sm font-black text-[#5B342C]">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[#EA7188]"
                  checked={allVisibleSelected}
                  onChange={(event) => setSelectedIds(event.target.checked ? visibleRows.map((row) => String(row.id ?? "")) : [])}
                />
                Chọn tất cả ({visibleRows.length})
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

          <section className="space-y-3">
            {resource === "bookings" ? <BookingCalendar bookings={rows} onMove={moveBooking} /> : null}
            {initialLoading && visibleRows.length === 0 ? (
              <PageSpinner label={`Đang tải ${config.label}…`} />
            ) : visibleRows.length === 0 && resource !== "wallets" ? (
              <Card className="rounded-[2rem] border-[#F4C7C4] bg-white py-12 text-center">
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#FFE4EA] text-[#EA7188]">
                  <ImageIcon size={22} />
                </div>
                <h2 className="mt-4 text-lg font-bold text-[#5B342C]">Chưa có dữ liệu</h2>
                <p className="mt-2 text-sm font-semibold text-[#9B746B]">Tạo bản ghi đầu tiên bằng form bên cạnh.</p>
              </Card>
            ) : resource === "transactions" ? (
              <TransactionDateListWithProgressive
                groups={transactionDayGroups}
                walletById={walletById}
                canEdit={canMutate(session)}
                canRemove={canDelete(session)}
                selectedIds={selectedIds}
                onToggleSelect={(id) => setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])}
                onEdit={edit}
                onDelete={setDeleteTarget}
                onOpenDetail={setDetailRow}
                onOpenGallery={openRowGallery}
              />
            ) : resource === "wallets" ? (
              <WalletAppView
                rows={visibleRows}
                transactions={walletTransactions}
                canRemove={canDelete(session)}
                selectedIds={selectedIds}
                onToggleSelect={(id) => setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])}
                onReceive={() => {
                  setTransactionIntent("income");
                  goToResource("transactions");
                }}
                onSpend={() => {
                  setTransactionIntent("expense");
                  goToResource("transactions");
                }}
                onTransfer={() => goToResource("transactions")}
                onWalletCreated={loadRows}
                onOpenDetail={setDetailRow}
              />
            ) : (
              <ResourceListWithProgressive
                resource={resource}
                visibleRows={visibleRows}
                config={config}
                session={session}
                selectedIds={selectedIds}
                setSelectedIds={setSelectedIds}
                focusedItemId={focusedItemId}
                longPressActivated={longPressActivated}
                setLongPressActivated={setLongPressActivated}
                setDetailRow={setDetailRow}
                startRowLongPress={startRowLongPress}
                clearLongPress={clearLongPress}
                edit={edit}
                setDeleteTarget={setDeleteTarget}
                openRowGallery={openRowGallery}
              />
            )}
          </section>
        </div>

      {(() => {
        if (!canMutate(session) || !showForm) return null;
        const formElement = (
          <div ref={formRef} className="order-1 scroll-mt-20 xl:order-2">
            <button className="studio-mobile-form-backdrop sm:hidden" aria-label="Đóng form" onClick={() => { setEditingId(null); setEditingSystemNote(""); setForm(emptyForm(config.fields)); setShowForm(false); }} />
            <Card className="studio-mobile-form-sheet rounded-[1.5rem] border-[#F4C7C4] bg-white shadow-[0_18px_50px_rgba(184,95,108,0.1)] sm:sticky sm:top-[5.5rem] sm:rounded-[2rem]">
              <div className="mb-4 flex items-center justify-between gap-3">
                <CardTitle>{title}</CardTitle>
                <div className="flex shrink-0 gap-2">
                  {editingId ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setEditingId(null);
                        setEditingSystemNote("");
                        setForm(emptyForm(config.fields));
                      }}
                    >
                      Hủy sửa
                    </Button>
                  ) : null}
                  <Button variant="secondary" size="icon" aria-label="Đóng form" onClick={() => { setEditingId(null); setEditingSystemNote(""); setForm(emptyForm(config.fields)); setShowForm(false); }}>
                    <X size={16} />
                  </Button>
                </div>
              </div>

              {groupedFields.image.length ? (
                <div className="mb-5 rounded-[1.5rem] bg-[#FFF3EC] p-4">
                  <p className="mb-3 text-sm font-bold text-[#5B342C]">Ảnh</p>
                  {groupedFields.image.map((field) => (
                    <label key={field.key}>
                      <span className="mb-2 block text-sm font-medium text-[#7B554D]">{field.label}</span>
                      {field.key === config.imageField && config.fields.some((item) => item.key === "galleryUrls") ? (
                        <MediaGalleryPicker
                          mainUrl={String(form[field.key] ?? "")}
                          galleryUrls={String(form.galleryUrls ?? "[]")}
                          onMainChange={(value) => setForm((current) => ({ ...current, [field.key]: value }))}
                          onGalleryChange={(value) => setForm((current) => ({ ...current, galleryUrls: value }))}
                        />
                      ) : (
                        <FieldInput field={field} value={form[field.key]} onChange={(value) => setForm((current) => ({ ...current, [field.key]: value }))} />
                      )}
                    </label>
                  ))}
                </div>
              ) : null}

              <div className="grid gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-1">
                {groupedFields.main.filter((field) => !(resource === "transactions" && field.key === "type")).map((field) => (
                  <label key={field.key}>
                    <span className="mb-2 block text-sm font-medium text-[#7B554D]">{field.label}</span>
                    {resource === "transactions" && field.key === "walletId" ? (
                      <select
                        className="h-12 w-full rounded-2xl border border-[#F1C5C1] bg-[#FFF9F4] px-4 text-sm font-semibold text-[#5B342C] outline-none transition focus:border-[#EA7188] focus:ring-2 focus:ring-[#FFD4DF]"
                        value={String(form.walletId ?? "")}
                        onChange={(event) => setForm((current) => ({ ...current, walletId: event.target.value }))}
                      >
                        <option value="">Chọn ví tiền</option>
                        {walletRows.map((wallet) => (
                          <option key={String(wallet.id)} value={String(wallet.id)}>
                            {String(wallet.name ?? "Ví không tên")} - {formatMoney(wallet.balance as string | number | null | undefined)}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <FieldInput field={field} value={form[field.key]} onChange={(value) => setForm((current) => ({ ...current, [field.key]: value }))} />
                    )}
                  </label>
                ))}
              </div>

              {groupedFields.note.length ? (
                <div className="mt-4 grid gap-4">
                  {groupedFields.note.map((field) => (
                    <label key={field.key}>
                      <span className="mb-2 block text-sm font-medium text-[#7B554D]">{field.label}</span>
                      <FieldInput field={field} value={form[field.key]} onChange={(value) => setForm((current) => ({ ...current, [field.key]: value }))} />
                    </label>
                  ))}
                </div>
              ) : null}

              <div className="mt-5 flex justify-end">
                <Button className="w-full sm:w-auto" onClick={save} disabled={submitting}>
                  {submitting ? <Loader2 className="animate-spin" size={17} /> : <Save size={17} />}
                  {submitting ? "Đang lưu..." : "Lưu dữ liệu"}
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



      {hasMoreRows ? (
        <div className="flex justify-center">
          <Button variant="secondary" disabled={loadingMoreRows} onClick={() => void loadRows("append", nextCursor)}>
            {loadingMoreRows ? <Loader2 className="animate-spin" size={17} /> : <ArrowDownLeft size={17} />}
            Tải thêm dữ liệu
          </Button>
        </div>
      ) : null}

      {detailRow ? (
        <ResourceDetailModal
          row={detailRow}
          resource={resource === "wallets" && detailRow.amount != null ? "transactions" : resource}
          config={resource === "wallets" && detailRow.amount != null ? getConfig("transactions") : config}
          walletById={detailWalletById}
          canEdit={canMutate(session)}
          canRemove={canDelete(session)}
          onClose={() => setDetailRow(null)}
          onEdit={edit}
          onDelete={setDeleteTarget}
          onOpenGallery={openRowGallery}
        />
      ) : null}

      {deleteTarget ? (
        <Portal>
          <div className="fixed inset-0 z-[150] grid place-items-center bg-slate-950/40 p-4" onClick={() => setDeleteTarget(null)}>
            <Card className="w-full max-w-lg rounded-[2rem]" onClick={(event) => event.stopPropagation()}>
              <CardTitle>Vui lòng lựa chọn</CardTitle>
              <p className="mt-2 text-sm font-semibold text-[#9B746B]">Bạn muốn xử lý dữ liệu này như thế nào?</p>
              <div className="mt-6 grid gap-3">
                <Button variant="danger" disabled={submitting} onClick={() => void remove(deleteTarget, "hard")}>
                  {submitting ? <Loader2 className="animate-spin mr-2" size={16} /> : null}
                  {submitting ? "Đang xóa..." : "Xóa"}
                </Button>
                <Button variant="secondary" disabled={submitting} onClick={() => void remove(deleteTarget, "trash")}>
                  {submitting ? <Loader2 className="animate-spin mr-2" size={16} /> : null}
                  {submitting ? "Đang chuyển..." : "Chuyển vào thùng rác"}
                </Button>
                <Button variant="ghost" disabled={submitting} onClick={() => setDeleteTarget(null)}>
                  Không xóa
                </Button>
              </div>
            </Card>
          </div>
        </Portal>
      ) : null}
      {bulkDeleteMode ? (
        <Portal>
          <div className="fixed inset-0 z-[150] grid place-items-center bg-slate-950/40 p-4" onClick={() => setBulkDeleteMode(null)}>
            <Card className="w-full max-w-lg rounded-[2rem]" onClick={(event) => event.stopPropagation()}>
              <CardTitle>Vui lòng lựa chọn</CardTitle>
              <p className="mt-2 whitespace-normal break-words text-sm font-semibold leading-6 text-[#9B746B]">
                {bulkDeleteMode === "all" ? `Bạn có chắc chắn muốn xóa tất cả ${visibleRows.length} mục đang hiển thị?` : `Bạn có chắc chắn muốn xóa ${selectedIds.length} mục đã chọn?`}
              </p>
              <div className="mt-6 grid gap-3">
                <Button variant="danger" disabled={submitting} onClick={() => void removeMany(bulkRows, "hard")}>
                  {submitting ? <Loader2 className="animate-spin mr-2" size={16} /> : null}
                  {submitting ? "Đang xóa..." : "Xóa"}
                </Button>
                <Button variant="secondary" disabled={submitting} onClick={() => void removeMany(bulkRows, "trash")}>
                  {submitting ? <Loader2 className="animate-spin mr-2" size={16} /> : null}
                  {submitting ? "Đang chuyển..." : "Chuyển vào thùng rác"}
                </Button>
                <Button variant="ghost" disabled={submitting} onClick={() => setBulkDeleteMode(null)}>
                  Không xóa
                </Button>
              </div>
            </Card>
          </div>
        </Portal>
      ) : null}
      <ImagePreview
        images={preview?.images}
        index={preview?.index ?? 0}
        alt={preview?.alt}
        onIndexChange={(index) => setPreview((current) => current ? { ...current, index } : current)}
        onClose={() => setPreview(null)}
      />
    </div>
  );
}

function thumbIndex(row: Row, url: string, imageField?: string) {
  const images = rowImages(row, imageField);
  const index = images.indexOf(url);
  return index >= 0 ? index : 0;
}

function OrderBadge({ value }: { value: number }) {
  return (
    <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-[#F4C7C4] bg-[#FFF3EC] text-xs font-black text-[#5B342C] sm:h-10 sm:w-10 sm:rounded-2xl sm:text-sm">
      {value}
    </div>
  );
}

function ResourceDetailModal({
  row,
  resource,
  config,
  walletById,
  canEdit,
  canRemove,
  onClose,
  onEdit,
  onDelete,
  onOpenGallery,
}: {
  row: Row;
  resource: ResourceKey;
  config: ReturnType<typeof getConfig>;
  walletById?: Map<string, Row>;
  canEdit: boolean;
  canRemove: boolean;
  onClose: () => void;
  onEdit: (row: Row) => void;
  onDelete: (row: Row) => void;
  onOpenGallery: (row: Row, index: number) => void;
}) {

  const printable = printableInvoiceData(row);
  const isFinancial = ["transactions", "invoices", "projects"].includes(resource);
  const isPlainTransaction = resource === "transactions" && !canPrintInvoice(row);
  const title = isPlainTransaction ? String(row.title ?? "Giao dịch") : isFinancial ? printable.customerName : String(row[config.primaryField] ?? "Chi tiết");
  const subtitle = isPlainTransaction
    ? `${viOption(row.type)} · ${formatMoney(row.amount as string | number | null | undefined)}`
    : isFinancial
      ? `Gói chụp: ${printable.packageName}`
      : config.secondaryField
        ? renderValue(config, config.secondaryField, row[config.secondaryField])
        : config.label;
  const images = rowImages(row, config.imageField);
  const imageGroups = detailImageGroups(row, resource, config.imageField);
  const fields = detailFields(config, resource);
  const displayDetailValue = (field: string) => {
    if (["note", "message"].includes(field)) return cleanSystemNote(row);
    if (resource === "transactions" && field === "walletId") {
      const wallet = walletById?.get(String(row.walletId ?? ""));
      const walletName = String(wallet?.name ?? "").trim();
      return walletName ? `${walletName} - Mèoo Xinhh Studio` : "Mèoo Xinhh Studio";
    }
    return renderValue(config, field, row[field]);
  };

  return (
    <DetailModal
      onClose={onClose}
      maxWidth="max-w-4xl"
      scrollKey={String(row.id)}
      header={
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#EA7188]">Chi tiết</p>
          <h2 className="mt-1 whitespace-normal break-words text-xl font-black leading-7 text-[#5B342C] sm:text-2xl">{title}</h2>
          {subtitle ? <p className="mt-1 whitespace-normal break-words text-sm font-bold leading-6 text-[#9B746B]">{subtitle}</p> : null}
        </div>
      }
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          {["invoices", "transactions"].includes(resource) ? <PrintInvoiceMenu row={row} /> : null}
          {canEdit ? (
            <Button variant="secondary" size="sm" onClick={() => { onClose(); onEdit(row); }}>
              Sửa
            </Button>
          ) : null}
          {canRemove ? (
            <Button variant="danger" size="sm" onClick={() => { onClose(); onDelete(row); }}>
              Xóa
            </Button>
          ) : null}
        </div>
      }
    >
      {images.length ? (
        <div className="rounded-[1.5rem] bg-[#FFF8F1] p-3 ring-1 ring-[#F4C7C4]">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#A84E61]">Bộ ảnh</p>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-[#EA7188]">{images.length} ảnh</span>
          </div>
          <div className="mt-3 grid gap-3">
            {imageGroups.map((group) => (
              <section key={group.label} className="rounded-[1.25rem] border border-[#F6D2CF] bg-white/70 p-2">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-[11px] font-black uppercase tracking-wide text-[#A84E61]">{group.label}</p>
                  <span className="rounded-full bg-[#FFF3EC] px-2 py-0.5 text-[10px] font-black text-[#EA7188]">{group.items.length} ảnh</span>
                </div>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                  {group.items.map((item) => (
                    <button
                      key={`${String(row.id ?? "detail")}-${item.index}-${item.src}`}
                      type="button"
                      onClick={() => onOpenGallery(row, item.index)}
                      className="relative aspect-square overflow-hidden rounded-2xl border border-[#F4C7C4] bg-white p-1 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                    >
                      <img src={item.src} alt="" className="h-full w-full object-contain" />
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      ) : null}

      {isFinancial && !isPlainTransaction ? (
        <div className={`${images.length ? "mt-5" : ""} grid gap-3 sm:grid-cols-3`}>
          <InfoPill label="Khách hàng" value={printable.customerName} />
          <InfoPill label="Gói chụp" value={printable.packageName} />
          <InfoPill label="Tổng tiền" value={formatMoney(printable.amount as string | number | null | undefined)} />
        </div>
      ) : null}

      <div className={`${images.length || (isFinancial && !isPlainTransaction) ? "mt-5" : ""} grid gap-3 sm:grid-cols-2 lg:grid-cols-3`}>
        {fields.map((field) => (
          <InfoPill key={field} label={fieldLabel(config, field)} value={displayDetailValue(field)} />
        ))}
      </div>

      {cleanSystemNote(row) ? (
        <div className="mt-5 rounded-[1.5rem] bg-[#FFF3EC] p-4">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#A84E61]">Ghi chú</p>
          <p className="mt-2 whitespace-normal break-words text-sm font-semibold leading-6 text-[#5B342C]">{cleanSystemNote(row)}</p>
        </div>
      ) : null}
    </DetailModal>
  );
}

function TransactionDateListWithProgressive({
  groups,
  ...props
}: {
  groups: Array<{ date: string; rows: Row[] }>;
  walletById: Map<string, Row>;
  canEdit: boolean;
  canRemove: boolean;
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  onEdit: (row: Row) => void;
  onDelete: (row: Row) => void;
  onOpenDetail: (row: Row) => void;
  onOpenGallery: (row: Row, index: number) => void;
}) {
  const { visibleItems, sentinelRef, hasMore } = useProgressiveList(groups, 8); // Load 8 groups (days) at a time

  return (
    <>
      <TransactionDateList {...props} groups={visibleItems} />
      <ProgressiveListSentinel refTarget={sentinelRef} hasMore={hasMore} label="Đang tải thêm ngày..." />
    </>
  );
}

function ResourceListWithProgressive({
  resource,
  visibleRows,
  config,
  session,
  selectedIds,
  setSelectedIds,
  focusedItemId,
  longPressActivated,
  setLongPressActivated,
  setDetailRow,
  startRowLongPress,
  clearLongPress,
  edit,
  setDeleteTarget,
  openRowGallery,
}: {
  resource: ResourceKey;
  visibleRows: Row[];
  config: ResourceConfig;
  session: ReturnType<typeof useUiStore.getState>["session"];
  selectedIds: string[];
  setSelectedIds: React.Dispatch<React.SetStateAction<string[]>>;
  focusedItemId: string | null;
  longPressActivated: boolean;
  setLongPressActivated: React.Dispatch<React.SetStateAction<boolean>>;
  setDetailRow: (row: Row | null) => void;
  startRowLongPress: (event: React.PointerEvent, row: Row) => void;
  clearLongPress: () => void;
  edit: (row: Row) => void;
  setDeleteTarget: (row: Row | null) => void;
  openRowGallery: (row: Row, index: number) => void;
}) {
  const { visibleItems, sentinelRef, hasMore } = useProgressiveList(visibleRows, 50);

  const rowGroups = resource === "transactions" ? [] : [{ title: "", tone: "", rows: visibleItems }];

  return (
    <>
      {rowGroups.map((group) => (
        <div key={group.title || "all"} className="space-y-3">
          {group.title ? (
            <div className={`w-fit rounded-2xl border px-4 py-2 text-sm font-black ${group.tone}`}>
              {group.title} · {group.rows.length}
            </div>
          ) : null}
          {group.rows.map((row, index) => {
            const primary = String(row[config.primaryField] ?? "Chưa đặt tên");
            const secondary = config.secondaryField ? renderValue(config, config.secondaryField, row[config.secondaryField]) : "";
            const statusField = config.tableFields.find((field: string) => ["status", "approvalStatus", "type", "isActive"].includes(field));
            const thumbs = rowGallery(row);
            const compact = ["invoices", "projects"].includes(resource);
            const richInfoCard = ["customers", "equipment"].includes(resource);

            if (compact) {
              return (
                <FinancialCompactCard
                  key={String(row.id ?? index)}
                  row={row}
                  resource={resource}
                  indexLabel={visibleRows.length - index}
                  selected={selectedIds.includes(String(row.id ?? ""))}
                  selectionMode={selectedIds.length > 0}
                  canEdit={canMutate(session)}
                  canRemove={canDelete(session)}
                  onToggleSelect={(id) => setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])}
                  onEdit={edit}
                  onDelete={setDeleteTarget}
                  onOpenDetail={setDetailRow}
                  onOpenGallery={openRowGallery}
                  focused={focusedItemId === String(row.id ?? "")}
                />
              );
            }

            const invoice = printableInvoiceData(row);
            const displayPrimary = compact ? invoice.customerName : primary;
            const compactImages = rowImages(row, config.imageField);
            const compactImage = compactImages[0];
            const displaySecondary = compact ? `Gói chụp: ${invoice.packageName}` : secondary;

            return (
              <Card
                key={String(row.id ?? index)}
                data-row-id={String(row.id ?? "")}
                onClick={() => {
                  if (longPressActivated) {
                    setLongPressActivated(false);
                    return;
                  }
                  if (compact) setDetailRow(row);
                }}
                onPointerDown={(event) => startRowLongPress(event, row)}
                onPointerUp={clearLongPress}
                onPointerCancel={clearLongPress}
                onPointerLeave={clearLongPress}
                className={cn(
                  "h-fit rounded-2xl p-2 transition hover:shadow-md sm:rounded-[1.5rem] sm:p-3",
                  compact ? "cursor-pointer" : "",
                  richInfoCard
                    ? "border-[#F4C7C4] bg-[linear-gradient(135deg,#FFFFFF_0%,#FFF8F1_48%,#FFF0F4_100%)] hover:-translate-y-0.5 hover:shadow-[0_18px_45px_rgba(184,95,108,0.16)]"
                    : "border-[#F4C7C4] bg-white hover:-translate-y-0.5 hover:shadow-[0_18px_45px_rgba(184,95,108,0.16)]",
                  focusedItemId === String(row.id ?? "") ? "ring-2 ring-[#EA7188]" : "",
                )}
              >
                <div className={cn("grid grid-cols-[auto_1fr_auto] items-start gap-2 sm:flex sm:flex-row md:flex-nowrap", resource === "customers" ? "sm:gap-2.5" : richInfoCard ? "sm:gap-3" : "sm:gap-4")}>
                  <OrderBadge value={visibleRows.length - index} />
                  {canDelete(session) && (selectedIds.length > 0 || selectedIds.includes(String(row.id ?? ""))) ? (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        const id = String(row.id ?? "");
                        setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
                      }}
                      className={cn(
                        "grid h-7 w-7 shrink-0 place-items-center rounded-lg border text-[11px] font-black transition",
                        selectedIds.includes(String(row.id ?? "")) ? "border-[#EA7188] bg-[#EA7188] text-white shadow-[0_0_0_4px_rgba(234,113,136,0.18)] scale-105" : "border-[#F4C7C4] bg-white text-[#EA7188]",
                      )}
                      aria-label="Chọn mục"
                    >
                      {selectedIds.includes(String(row.id ?? "")) ? "✓" : ""}
                    </button>
                  ) : null}
                  {compact ? (
                    compactImage ? (
                      <button
                        type="button"
                        onClick={(event) => { event.stopPropagation(); openRowGallery(row, 0); }}
                        className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[#F4C7C4] bg-white p-1 shadow-sm sm:h-20 sm:w-20"
                      >
                        <img src={compactImage} alt="" className="max-h-full max-w-full object-contain" />
                        <span className="absolute bottom-1 left-1 right-1 rounded-full bg-white/95 px-1 py-0.5 text-[9px] font-black text-[#A84E61] shadow-sm">
                          {evidenceImageLabel(row, resource, 0)}
                        </span>
                      </button>
                    ) : null
                  ) : (
                    <button type="button" className={resource === "customers" ? "self-start" : ""} onClick={(event) => { event.stopPropagation(); openRowGallery(row, 0); }}>
                      <RowImage row={row} field={config.imageField} index={index} dense={resource === "customers"} />
                    </button>
                  )}
                  <div className="col-span-2 min-w-0 flex-1 sm:col-span-1">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className={cn("whitespace-normal break-words font-black leading-5 text-[#5B342C] sm:leading-6", richInfoCard ? "text-sm sm:text-lg" : "text-base sm:text-lg")}>{displayPrimary}</h2>
                        {displaySecondary ? <p className={cn("mt-0.5 whitespace-normal break-words text-sm font-semibold", richInfoCard ? "text-[#A06F65]" : "text-[#9B746B]")}>{displaySecondary}</p> : null}
                        {compact ? <p className="mt-2 text-lg font-black text-emerald-700">+{formatMoney(invoice.amount as string | number | null | undefined)}</p> : null}
                      </div>
                      {statusField ? (
                        <span className={cn("rounded-full px-3 py-1 text-xs font-bold ring-1", statusTone(row[statusField]))}>
                          {viOption(row[statusField])}
                        </span>
                      ) : null}
                    </div>
                    {!compact ? (
                      <div className={cn("mt-2 grid grid-cols-2 gap-1.5 sm:gap-2.5", resource === "customers" ? "md:grid-cols-4 xl:grid-cols-5" : richInfoCard ? "xl:grid-cols-4" : "sm:mt-4 sm:gap-3 xl:grid-cols-3")}>
                        {cardInfoFields(config, resource, richInfoCard)
                          .map((field) => {
                            const noteLike = ["note", "message"].includes(field);
                            const value = noteLike ? cleanSystemNote(row) || "Chưa có ghi chú" : renderValue(config, field, row[field]);
                            return (
                              <div key={field} className={cn("min-w-0 rounded-xl border border-[#F8D8D4] bg-white/78 px-2 py-1.5 shadow-sm sm:rounded-2xl sm:px-3 sm:py-2", resource === "customers" && noteLike ? "col-span-2 md:col-span-4 xl:col-span-1" : richInfoCard && noteLike ? "col-span-2 xl:col-span-2" : "")}>
                                <p className="text-[11px] font-black uppercase tracking-wide text-[#C87888]">{fieldLabel(config, field)}</p>
                                <p className={cn("mt-0.5 whitespace-normal break-words text-xs font-bold leading-5 text-[#5B342C] sm:mt-1 sm:text-sm", richInfoCard && noteLike ? "max-h-16 overflow-hidden" : "")}>{value}</p>
                              </div>
                            );
                          })}
                      </div>
                    ) : null}
                    {thumbs.length && !compact ? (
                      <div className="mt-3 hidden w-fit gap-2 rounded-2xl border border-[#F4C7C4] bg-[#FFF3EC] p-2 sm:flex">
                        {thumbs.map((url, index) => (
                          <button
                            key={`${url}-${index}`}
                            type="button"
                            onClick={() => openRowGallery(row, thumbIndex(row, url, config.imageField))}
                            className="relative flex min-h-20 w-24 items-center justify-center rounded-xl border border-[#F4C7C4] bg-white p-1 transition hover:scale-[1.02] hover:shadow-sm"
                          >
                            <img src={url} alt="" className="max-h-32 max-w-full object-contain" />
                            <span className="absolute bottom-1 left-1 right-1 rounded-full bg-white/95 px-1.5 py-0.5 text-[10px] font-black text-[#A84E61] shadow-sm">
                              {imageBadgeLabel(resource, thumbIndex(row, url, config.imageField))}
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  {canMutate(session) ? (
                    <div className="col-span-3 flex shrink-0 flex-row justify-end gap-2 sm:col-span-1 md:flex-col">
                      {["invoices", "transactions"].includes(resource) ? <PrintInvoiceMenu row={row} /> : null}
                      <Button variant="secondary" size="icon" className="h-10 w-10 shrink-0 rounded-2xl" aria-label="Sửa dữ liệu" onClick={(event) => { event.stopPropagation(); edit(row); }}>
                        <Pencil size={16} className="text-[#EA7188]" />
                      </Button>
                      {canDelete(session) ? (
                        <Button variant="danger" size="icon" className="h-10 w-10 shrink-0 rounded-2xl" aria-label="Xóa dữ liệu" onClick={(event) => { event.stopPropagation(); setDeleteTarget(row); }}>
                          <Trash2 size={16} />
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </Card>
            );
          })}
        </div>
      ))}
      <ProgressiveListSentinel refTarget={sentinelRef} hasMore={hasMore} />
    </>
  );
}

function TransactionDateList({
  groups,
  walletById,
  canEdit,
  canRemove,
  selectedIds,
  onToggleSelect,
  onEdit,
  onDelete,
  onOpenDetail,
  onOpenGallery,
}: {
  groups: Array<{ date: string; rows: Row[] }>;
  walletById: Map<string, Row>;
  canEdit: boolean;
  canRemove: boolean;
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  onEdit: (row: Row) => void;
  onDelete: (row: Row) => void;
  onOpenDetail: (row: Row) => void;
  onOpenGallery: (row: Row, index: number) => void;
}) {
  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <section key={group.date} className="space-y-3">
          <div className="sticky top-20 z-10 w-fit rounded-2xl border border-[#F4C7C4] bg-white/95 px-4 py-2 text-sm font-black text-[#5B342C] shadow-sm backdrop-blur">
            {group.date} · {group.rows.length} giao dịch
          </div>
          <div className="grid gap-3">
            {group.rows.map((row, index) => {
              const id = String(row.id ?? "");
              const isIncome = String(row.type) === "INCOME";
              const wallet = walletById.get(String(row.walletId ?? ""));
              const tone = isIncome ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700";
              const proofImages = rowImages(row, "imageUrl");
              const invoice = printableInvoiceData(row);
              return (
                <FinancialCompactCard
                  key={id || index}
                  row={row}
                  resource="transactions"
                  indexLabel={group.rows.length - index}
                  selected={selectedIds.includes(id)}
                  selectionMode={selectedIds.length > 0}
                  canEdit={canEdit}
                  canRemove={canRemove}
                  onToggleSelect={onToggleSelect}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onOpenDetail={onOpenDetail}
                  onOpenGallery={onOpenGallery}
                />
              );
              return (
                <Card
                  key={id || index}
                  className="cursor-pointer rounded-[1.5rem] border-[#F4C7C4] bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-[0_18px_45px_rgba(184,95,108,0.16)]"
                  onClick={() => onOpenDetail(row)}
                >
                  <div className="grid gap-3 sm:grid-cols-[auto_1fr_auto] sm:items-start">
                    <div className="flex items-center gap-2">
                      <OrderBadge value={group.rows.length - index} />
                      {canRemove ? (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            onToggleSelect(id);
                          }}
                          className="grid h-6 w-6 place-items-center rounded-md border border-[#F4C7C4] bg-white text-[10px] font-black text-[#EA7188]"
                          aria-label="Chọn giao dịch"
                        >
                          {selectedIds.includes(id) ? "✓" : ""}
                        </button>
                      ) : null}
                    </div>

                    <div className="min-w-0 space-y-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${tone}`}>
                            {isIncome ? "Khoản thu" : "Khoản chi"}
                          </span>
                          <h2 className="mt-2 whitespace-normal break-words text-lg font-black leading-6 text-[#5B342C]">{String(row.title ?? "Chưa có nội dung")}</h2>
                          {invoice.packageName ? <p className="mt-1 whitespace-normal break-words text-sm font-black text-[#5B342C]">Gói chụp: {invoice.packageName}</p> : null}
                          <p className="mt-1 text-sm font-semibold text-[#9B746B]">Tạo lúc {formatTimeLabel(row.createdAt)} · Phát sinh {formatDate(row.occurredAt as string | Date | null | undefined)}</p>
                        </div>
                        <p className={`text-xl font-black ${isIncome ? "text-emerald-700" : "text-rose-700"}`}>
                          {isIncome ? "+" : "-"}{formatMoney(row.amount as string | number | null | undefined)}
                        </p>
                      </div>

                      {proofImages.length ? (
                        <div className="flex flex-wrap gap-2">
                          {proofImages.slice(0, 3).map((src, imageIndex) => (
                            <button
                              key={`${id || index}-proof-${imageIndex}-${src}`}
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                onOpenGallery(row, imageIndex);
                              }}
                              className="relative h-14 w-14 overflow-hidden rounded-2xl border border-[#F4C7C4] bg-white shadow-sm transition hover:-translate-y-0.5 sm:h-16 sm:w-16"
                              aria-label="Xem ảnh minh chứng"
                            >
                              <img src={src} alt="" className="h-full w-full object-contain p-1" />
                              <span className="absolute left-1 top-1 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-black text-[#A84E61] shadow-sm">
                                {evidenceImageLabel(row, "transactions", imageIndex)}
                              </span>
                            </button>
                          ))}
                        </div>
                      ) : null}

                      <div className="hidden gap-2 sm:grid sm:grid-cols-3">
                        <InfoPill label="Ví" value={String(wallet?.name ?? "Chưa chọn ví")} />
                        <InfoPill label="Trạng thái" value={viOption(row.approvalStatus)} />
                        <InfoPill label={isIncome ? "Tiền đi vào" : "Tiền đi ra"} value={String(wallet?.type ?? "Chưa có loại ví")} />
                      </div>
                    </div>

                    {canEdit ? (
                      <div className="flex justify-end gap-2 sm:flex-col">
                        <PrintInvoiceMenu row={row} />
                        <Button variant="secondary" size="sm" onClick={(event) => { event.stopPropagation(); onEdit(row); }}>Sửa</Button>
                        {canRemove ? (
                          <Button variant="danger" size="icon" aria-label="Xóa giao dịch" onClick={(event) => { event.stopPropagation(); onDelete(row); }}>
                            <Trash2 size={16} />
                          </Button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </Card>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

function WalletAppView({
  rows,
  transactions,
  canRemove,
  selectedIds,
  onToggleSelect,
  onReceive,
  onSpend,
  onTransfer,
  onWalletCreated,
  onOpenDetail,
}: {
  rows: Row[];
  transactions: Row[];
  canRemove: boolean;
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  onReceive: () => void;
  onSpend: () => void;
  onTransfer: () => void;
  onWalletCreated: () => void | Promise<void>;
  onOpenDetail: (row: Row) => void;
}) {
  const [activeWalletId, setActiveWalletId] = useState(() => String(rows[0]?.id ?? ""));
  const [shiftData, setShiftData] = useState<ShiftData>({ openShift: null, shifts: [] });
  const [shiftMessage, setShiftMessage] = useState("");
  const [openingBalance, setOpeningBalance] = useState("");
  const [openingNote, setOpeningNote] = useState("");
  const [actualClosingBalance, setActualClosingBalance] = useState("");
  const [closeNote, setCloseNote] = useState("");
  const [openingOpen, setOpeningOpen] = useState(false);
  const [closingOpen, setClosingOpen] = useState(false);
  const [shiftListOpen, setShiftListOpen] = useState(false);
  const [selectedShift, setSelectedShift] = useState<Row | null>(null);
  const [deleteShiftTarget, setDeleteShiftTarget] = useState<Row | null>(null);
  const [deleteShiftPassword, setDeleteShiftPassword] = useState("");
  const [deleteShiftMessage, setDeleteShiftMessage] = useState("");
  const [isOpening, setIsOpening] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [walletLongPressTimer, setWalletLongPressTimer] = useState<number | null>(null);
  const [walletLongPressActivated, setWalletLongPressActivated] = useState(false);
  const activeWallet = rows.find((row) => String(row.id ?? "") === activeWalletId) ?? rows[0];

  function clearWalletLongPress() {
    if (walletLongPressTimer !== null) {
      window.clearTimeout(walletLongPressTimer);
      setWalletLongPressTimer(null);
    }
  }

  function startWalletLongPress(event: React.PointerEvent, id: string) {
    const target = event.target as HTMLElement;
    const currentTarget = event.currentTarget as HTMLElement;
    if (!canRemove || (target !== currentTarget && target.closest("button,a,input,select,textarea"))) return;
    clearWalletLongPress();
    const timer = window.setTimeout(() => {
      onToggleSelect(id);
      setWalletLongPressActivated(true);
      setWalletLongPressTimer(null);
    }, 520);
    setWalletLongPressTimer(timer);
  }

  const loadShiftData = useCallback(async (walletId: string) => {
    if (!walletId) return;
    const payload = await fetch(`/api/wallet-shifts?walletId=${encodeURIComponent(walletId)}`)
      .then((res) => res.json())
      .catch(() => null);
    if (payload?.data) setShiftData(payload.data);
    if (payload?.error && !/chưa đăng nhập/i.test(payload.error.message)) setShiftMessage(payload.error.message);
  }, []);

  const activeWalletTransactions = useMemo(() => {
    const walletId = String(activeWallet?.id ?? "");
    return transactions.filter((row) => String(row.walletId ?? "") === walletId);
  }, [transactions, activeWallet]);

  useEffect(() => {
    const walletId = String(activeWallet?.id ?? "");
    if (!walletId) return;
    const timer = window.setTimeout(() => {
      setShiftMessage("");
      setOpeningOpen(false);
      setClosingOpen(false);
      setSelectedShift(null);
      setDeleteShiftTarget(null);
      setDeleteShiftPassword("");
      setDeleteShiftMessage("");
      setActualClosingBalance("");
      setCloseNote("");
      void loadShiftData(walletId);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [activeWallet, loadShiftData]);

  const sumByType = (items: Row[], type: string) =>
    items.filter((row) => String(row.type ?? "") === type).reduce((total, row) => total + Number(row.amount ?? 0), 0);
  const isActive = activeWallet?.isActive === true || String(activeWallet?.isActive) === "true";
  const openShift = shiftData.openShift;
  const closedShifts = shiftData.shifts.filter((shift) => String(shift.status ?? "") === "CLOSED");
  const currentShiftTransactions = useMemo(() => {
    if (!openShift) return [];
    const openedAt = new Date(String(openShift.openedAt ?? ""));
    return activeWalletTransactions.filter((row) => {
      const occurredAt = new Date(String(row.occurredAt ?? row.createdAt ?? ""));
      return occurredAt >= openedAt;
    });
  }, [activeWalletTransactions, openShift]);
  const currentShiftIncome = sumByType(currentShiftTransactions, "INCOME");
  const currentShiftExpense = sumByType(currentShiftTransactions, "EXPENSE");
  const currentShiftProfit = currentShiftIncome - currentShiftExpense;
  const endingBalance = openShift ? openShift.expectedClosingBalance : activeWallet?.openingBalance;

  async function openShiftNow() {
    setIsOpening(true);
    setShiftMessage("");
    let wallet = activeWallet;
    if (!wallet) {
      const opening = Number(openingBalance || 0);
      const walletPayload = await fetch("/api/resources/wallets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Quỹ tiền mặt",
          type: "Tiền mặt",
          openingBalance: opening,
          balance: opening,
          isActive: true,
        }),
      }).then((res) => res.json()).catch(() => null);
      if (walletPayload?.error) {
        setShiftMessage(walletPayload.error.message);
        setIsOpening(false);
        return false;
      }
      wallet = walletPayload?.data;
      await onWalletCreated();
    }
    if (!wallet) {
      setShiftMessage("Chưa tạo được quỹ tiền để mở ca.");
      setIsOpening(false);
      return false;
    }
    const payload = await fetch("/api/wallet-shifts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        walletId: wallet.id,
        openingBalance: openingBalance || wallet.balance || 0,
        note: openingNote,
      }),
    }).then((res) => res.json()).catch(() => null);
    if (payload?.error) {
      setShiftMessage(payload.error.message);
      setIsOpening(false);
      return false;
    }
    setOpeningBalance("");
    setOpeningNote("");
    setShiftMessage("Đã mở ca. Mọi khoản thu/chi trong ví này sẽ được tính vào ca đang hoạt động.");
    startTransition(() => {
      setOpeningOpen(false);
      setIsOpening(false);
    });
    if (wallet.id) {
      setActiveWalletId(String(wallet.id));
      await loadShiftData(String(wallet.id));
    }
    return true;
  }

  async function closeShiftNow() {
    if (!openShift || !activeWallet) return false;
    setIsClosing(true);
    setShiftMessage("");
    const payload = await fetch("/api/wallet-shifts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        shiftId: openShift.id,
        actualClosingBalance: actualClosingBalance || openShift.expectedClosingBalance || 0,
        closeNote,
      }),
    }).then((res) => res.json()).catch(() => null);
    if (payload?.error) {
      setShiftMessage(payload.error.message);
      setIsClosing(false);
      return false;
    }
    setActualClosingBalance("");
    setCloseNote("");
    setShiftMessage("Đã đóng ca và lưu vào danh sách ca.");
    startTransition(() => {
      setClosingOpen(false);
      setSelectedShift(null);
      setIsClosing(false);
    });
    await loadShiftData(String(activeWallet.id ?? ""));
    window.scrollTo({ top: 0, behavior: "auto" });
    return true;
  }

  async function deleteShiftNow() {
    if (!deleteShiftTarget || !activeWallet) return;
    setIsDeleting(true);
    setDeleteShiftMessage("");
    const payload = await fetch("/api/wallet-shifts", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        shiftId: deleteShiftTarget.id,
        password: deleteShiftPassword,
      }),
    }).then((res) => res.json()).catch(() => null);

    if (payload?.error) {
      setDeleteShiftMessage(payload.error.message);
      setIsDeleting(false);
      return;
    }

    setDeleteShiftTarget(null);
    setDeleteShiftPassword("");
    setDeleteShiftMessage("");
    setShiftMessage("Đã xóa ca.");
    startTransition(() => {
      setSelectedShift(null);
      setIsDeleting(false);
    });
    await loadShiftData(String(activeWallet.id ?? ""));
  }

  const walletHistoryColumns = useMemo(
    () => [
      {
        key: "income",
        title: "Thu",
        total: currentShiftIncome,
        icon: <ArrowDownLeft size={16} />,
        panelClass: "border-emerald-100 bg-emerald-50/65",
        headerClass: "bg-emerald-600 text-white",
        amountClass: "text-emerald-700",
        iconClass: "bg-emerald-100 text-emerald-700",
        rows: currentShiftTransactions.filter((row) => String(row.type ?? "") === "INCOME").slice(0, 24),
      },
      {
        key: "expense",
        title: "Chi",
        total: currentShiftExpense,
        icon: <ArrowUpRight size={16} />,
        panelClass: "border-rose-100 bg-rose-50/65",
        headerClass: "bg-rose-600 text-white",
        amountClass: "text-rose-700",
        iconClass: "bg-rose-100 text-rose-700",
        rows: currentShiftTransactions.filter((row) => String(row.type ?? "") === "EXPENSE").slice(0, 24),
      },
    ],
    [currentShiftTransactions, currentShiftExpense, currentShiftIncome],
  );
  const transactionsForSelectedShift = useMemo(
    () =>
      selectedShift
        ? activeWalletTransactions.filter((row) => {
            const occurredAt = new Date(String(row.occurredAt ?? row.createdAt ?? ""));
            const openedAt = new Date(String(selectedShift.openedAt ?? ""));
            const closedAt = selectedShift.closedAt ? new Date(String(selectedShift.closedAt)) : new Date();
            return occurredAt >= openedAt && occurredAt <= closedAt;
          })
        : [],
    [activeWalletTransactions, selectedShift],
  );
  const selectedShiftTransactionColumns = useMemo(
    () => [
      {
        key: "income",
        title: "Thu",
        total: sumByType(transactionsForSelectedShift, "INCOME"),
        icon: <ArrowDownLeft size={16} />,
        panelClass: "border-emerald-100 bg-emerald-50/65",
        headerClass: "bg-emerald-600 text-white",
        amountClass: "text-emerald-700",
        iconClass: "bg-emerald-100 text-emerald-700",
        rows: transactionsForSelectedShift.filter((row) => String(row.type ?? "") === "INCOME"),
      },
      {
        key: "expense",
        title: "Chi",
        total: sumByType(transactionsForSelectedShift, "EXPENSE"),
        icon: <ArrowUpRight size={16} />,
        panelClass: "border-rose-100 bg-rose-50/65",
        headerClass: "bg-rose-600 text-white",
        amountClass: "text-rose-700",
        iconClass: "bg-rose-100 text-rose-700",
        rows: transactionsForSelectedShift.filter((row) => String(row.type ?? "") === "EXPENSE"),
      },
    ],
    [transactionsForSelectedShift],
  );
  const closingExpected = Number(openShift?.expectedClosingBalance ?? 0);
  const closingActual = actualClosingBalance === "" ? closingExpected : Number(actualClosingBalance);
  const closingDifference = closingActual - closingExpected;

  const renderSelectedShiftTransactions = () => (
    <div className="mt-5">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-base font-black text-[#2F2F2F]">Giao dịch trong ca</h4>
        <span className="rounded-full bg-[#F6F7FB] px-3 py-1 text-xs font-black text-[#7A7A7A]">{transactionsForSelectedShift.length} mục</span>
      </div>
      {transactionsForSelectedShift.length ? (
        <div className="mt-3 grid grid-cols-2 gap-2 sm:gap-3">
          {selectedShiftTransactionColumns.map((column) => (
            <div key={column.key} className={cn("min-w-0 rounded-[1.25rem] border p-2 sm:rounded-[1.5rem] sm:p-3", column.panelClass)}>
              <div className={cn("flex min-h-[4rem] items-center justify-between gap-2 rounded-[1rem] px-2.5 py-2 sm:px-3", column.headerClass)}>
                <div className="min-w-0">
                  <p className="text-[11px] font-black uppercase tracking-wide opacity-80">{column.title}</p>
                  <p className="mt-0.5 truncate text-sm font-black sm:text-base">{formatMoney(column.total)}</p>
                </div>
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-white/18">{column.icon}</span>
              </div>
              <div className="studio-ios-scroll mt-2 max-h-[42dvh] space-y-2 overflow-y-auto pr-0.5">
                {column.rows.length ? (
                  column.rows.map((row, index) => {
                    const id = String(row.id ?? "");
                    return (
                      <div
                        key={id || `${column.key}-${index}`}
                        role="button"
                        tabIndex={0}
                        className="grid min-h-[5.8rem] cursor-pointer grid-rows-[auto_1fr_auto] rounded-[1rem] bg-white p-2 text-left shadow-sm ring-1 ring-black/5 transition hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#EA7188]/35 active:scale-[0.99] sm:min-h-[6.4rem] sm:p-2.5"
                        onClick={() => onOpenDetail(row)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            onOpenDetail(row);
                          }
                        }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-xl", column.iconClass)}>
                            {column.icon}
                          </span>
                          <PrintInvoiceMenu row={row} />
                        </div>
                        <div className="min-w-0 py-1">
                          <p className="line-clamp-2 text-xs font-black leading-4 text-[#2F2F2F] sm:text-sm sm:leading-5">{String(row.title ?? "Giao dịch")}</p>
                          <p className="mt-1 truncate text-[11px] font-bold text-[#7A7A7A]">{formatDateTimeLabel(row.occurredAt ?? row.createdAt)}</p>
                        </div>
                        <p className={cn("truncate text-sm font-black sm:text-base", column.amountClass)}>{column.key === "income" ? "+" : "-"}{formatMoney(row.amount as string | number | null | undefined)}</p>
                      </div>
                    );
                  })
                ) : (
                  <div className="grid min-h-[5.8rem] place-items-center rounded-[1rem] bg-white p-2.5 text-center text-xs font-bold text-[#7A7A7A] shadow-sm ring-1 ring-black/5 sm:min-h-[6.4rem]">
                    Chưa có khoản {column.title.toLowerCase()}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-3 rounded-[1.5rem] bg-[#F6F7FB] p-5 text-center text-sm font-bold text-[#7A7A7A]">
          Ca này chưa có giao dịch.
        </div>
      )}
    </div>
  );

  const renderClosedShiftList = () => (
    <div className="mt-6">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 rounded-[1.35rem] bg-[#F6F7FB] px-4 py-3 text-left transition hover:bg-[#EEF0F6] active:scale-[0.99]"
        onClick={() => setShiftListOpen((value) => !value)}
      >
        <h4 className="text-base font-black text-[#2F2F2F]">Danh sách ca</h4>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-[#7A7A7A] shadow-sm">
          {closedShifts.length} ca · {shiftListOpen ? "Thu gọn" : "Xem"}
        </span>
      </button>
      {shiftListOpen ? (
        closedShifts.length ? (
          <div className="mt-3 space-y-2">
            {closedShifts.map((shift, index) => (
              <div
                key={String(shift.id ?? index)}
                role="button"
                tabIndex={0}
                className="rounded-[1.4rem] bg-[#F6F7FB] p-3 text-left transition hover:bg-[#EEF0F6] focus:outline-none focus:ring-2 focus:ring-[#EA7188]/40 active:scale-[0.99]"
                onClick={() => setSelectedShift(shift)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setSelectedShift(shift);
                  }
                }}
              >
                <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-center">
                  <div>
                    <p className="text-xs font-bold text-[#7A7A7A]">{String(shift.code ?? "Ca đã đóng")}</p>
                    <p className="mt-1 text-lg font-black text-emerald-700">{formatMoney(shift.totalIncome as string | number | null | undefined)}</p>
                    <p className="mt-1 text-xs font-black text-[#EA7188]">Bấm để xem chi tiết</p>
                  </div>
                  <div className="text-sm font-bold leading-6 text-[#5B342C]">
                    <p>Mở: {formatDateTimeLabel(shift.openedAt)}</p>
                    <p>Đóng: {formatDateTimeLabel(shift.closedAt)}</p>
                    <p>Người đóng: {String((shift.closedBy as Row | undefined)?.name ?? "Chưa rõ")}</p>
                  </div>
                  {canRemove ? (
                    <div className="flex flex-wrap gap-2 sm:justify-end">
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={(event) => {
                          event.stopPropagation();
                          setDeleteShiftTarget(shift);
                          setDeleteShiftPassword("");
                          setDeleteShiftMessage("");
                        }}
                      >
                        Xóa
                      </Button>
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-3 rounded-[1.5rem] bg-[#F6F7FB] p-5 text-center text-sm font-bold text-[#7A7A7A]">
            Chưa có ca đã đóng.
          </div>
        )
      ) : null}
    </div>
  );

  if (!activeWallet) {
    return (
      <div className="mx-auto max-w-[760px] rounded-[2rem] bg-[#F6F7FB] p-3 shadow-[0_24px_70px_rgba(52,64,84,0.10)] sm:p-5">
        <Card className="rounded-[1.75rem] border-white bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#7A7A7A]">Ca làm việc</p>
              <h3 className="mt-1 text-2xl font-black text-[#2F2F2F]">Mở ca</h3>
              <p className="mt-1 text-sm font-semibold leading-6 text-[#7A7A7A]">Chưa có quỹ tiền. Mở ca đầu tiên sẽ tự tạo Quỹ tiền mặt cho studio.</p>
            </div>
            <span className="rounded-full bg-emerald-50 px-3 py-2 text-sm font-black text-emerald-700">Sẵn sàng mở</span>
          </div>
          <AlertModal isOpen={!!shiftMessage} message={shiftMessage} onClose={() => setShiftMessage("")} />
          <Button className="mt-5 h-14 w-full rounded-2xl bg-emerald-600 text-base font-black text-white hover:bg-emerald-700" onClick={() => setOpeningOpen(true)}>
            Mở ca
          </Button>
          {renderClosedShiftList()}
        </Card>
        {openingOpen ? (
          <Portal>
            <div className="fixed inset-0 z-[150] grid place-items-center bg-black/40 p-4" onClick={() => setOpeningOpen(false)}>
              <Card className="w-full max-w-md rounded-[1.75rem] border-white bg-white p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-2xl font-black text-[#2F2F2F]">Mở ca</h3>
                  <Button variant="secondary" size="icon" aria-label="Đóng" onClick={() => setOpeningOpen(false)}>
                    <X size={18} />
                  </Button>
                </div>
                <div className="mt-5 space-y-3">
                  <label className="block">
                    <span className="mb-2 block text-sm font-black text-[#5B342C]">Tiền đầu ca</span>
                    <Input type="number" value={openingBalance} placeholder="0" onChange={(event) => setOpeningBalance(event.target.value)} />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-black text-[#5B342C]">Ghi chú mở ca</span>
                    <Input value={openingNote} placeholder="Ví dụ: ca sáng / ca tối" onChange={(event) => setOpeningNote(event.target.value)} />
                  </label>
                  <Button className="h-12 w-full rounded-2xl bg-emerald-600 text-base font-black text-white hover:bg-emerald-700" onClick={() => void openShiftNow()}>
                    Xác nhận
                  </Button>
                </div>
              </Card>
            </div>
          </Portal>
        ) : null}
      </div>
    );
  }

  if (!openShift) {
    return (
      <div className="mx-auto max-w-[860px] rounded-[2rem] bg-[#F6F7FB] p-3 shadow-[0_24px_70px_rgba(52,64,84,0.10)] sm:p-5">
        <Card className="rounded-[1.75rem] border-white bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#7A7A7A]">Ca làm việc</p>
              <h3 className="mt-1 text-2xl font-black text-[#2F2F2F]">Chưa mở ca</h3>
            </div>
            <span className="rounded-full bg-emerald-50 px-3 py-2 text-sm font-black text-emerald-700">Sẵn sàng mở</span>
          </div>

          <AlertModal isOpen={!!shiftMessage} message={shiftMessage} onClose={() => setShiftMessage("")} />

          <Button className="mt-5 h-14 w-full rounded-2xl bg-emerald-600 text-base font-black text-white hover:bg-emerald-700" onClick={() => setOpeningOpen(true)}>
            Mở ca
          </Button>

          {renderClosedShiftList()}
        </Card>

        {openingOpen ? (
          <Portal>
            <div className="fixed inset-0 z-[150] grid place-items-center bg-black/40 p-4" onClick={() => setOpeningOpen(false)}>
              <Card className="w-full max-w-md rounded-[1.75rem] border-white bg-white p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-2xl font-black text-[#2F2F2F]">Mở ca {shiftData.nextCode ? `(${shiftData.nextCode})` : ""}</h3>
                  <Button variant="secondary" size="icon" aria-label="Đóng" onClick={() => setOpeningOpen(false)}>
                    <X size={18} />
                  </Button>
                </div>
                <div className="mt-5 space-y-3">
                  <label className="block">
                    <span className="mb-2 block text-sm font-black text-[#5B342C]">Tiền đầu ca</span>
                    <Input type="number" value={openingBalance} placeholder={String(activeWallet.balance ?? "0")} onChange={(event) => setOpeningBalance(event.target.value)} />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-black text-[#5B342C]">Ghi chú mở ca</span>
                    <Input value={openingNote} placeholder="Ví dụ: ca sáng / ca tối" onChange={(event) => setOpeningNote(event.target.value)} />
                  </label>
                  <Button className="h-12 w-full rounded-2xl bg-emerald-600 text-base font-black text-white hover:bg-emerald-700" onClick={() => void openShiftNow()} disabled={isOpening}>
                    {isOpening ? <Loader2 className="mr-2 animate-spin" size={18} /> : null}
                    Xác nhận
                  </Button>
                </div>
              </Card>
            </div>
          </Portal>
        ) : null}

        {deleteShiftTarget ? (
          <Portal>
            <div className="fixed inset-0 z-[150] grid place-items-center bg-black/40 p-4" onClick={() => setDeleteShiftTarget(null)}>
              <Card className="w-full max-w-md rounded-[1.75rem] border-white bg-white p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-2xl font-black text-[#2F2F2F]">Xóa ca</h3>
                  <Button variant="secondary" size="icon" aria-label="Đóng" onClick={() => setDeleteShiftTarget(null)}>
                    <X size={18} />
                  </Button>
                </div>
                <p className="mt-3 text-sm font-bold leading-6 text-[#7A7A7A]">
                  Nhập mật khẩu studio 6 số để xóa ca này. Mật khẩu mặc định ban đầu là 000000.
                </p>
                <label className="mt-4 block">
                  <span className="mb-2 block text-sm font-black text-[#5B342C]">Mật khẩu studio</span>
                  <Input type="password" inputMode="numeric" value={deleteShiftPassword} placeholder="000000" onChange={(event) => setDeleteShiftPassword(event.target.value.replace(/\D/g, "").slice(0, 6))} />
                </label>
                {deleteShiftMessage ? <p className="mt-3 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{deleteShiftMessage}</p> : null}
                <Button variant="danger" className="mt-4 h-12 w-full rounded-2xl text-base font-black" onClick={() => void deleteShiftNow()} disabled={isDeleting}>
                  {isDeleting ? <Loader2 className="mr-2 animate-spin" size={18} /> : null}
                  Xác nhận xóa
                </Button>
              </Card>
            </div>
          </Portal>
        ) : null}

        {selectedShift ? (
          <Portal>
            <div className="fixed inset-0 z-[220] grid place-items-start bg-black/45 p-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] sm:place-items-center sm:p-4" onClick={() => setSelectedShift(null)}>
              <Card className="max-h-[calc(100dvh-1.5rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] w-full max-w-3xl overflow-y-auto rounded-[1.5rem] border-white bg-white p-4 shadow-2xl sm:rounded-[1.75rem] sm:p-5" onClick={(event) => event.stopPropagation()}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-[#EA7188]">Chi tiết ca</p>
                    <h3 className="mt-1 text-2xl font-black text-[#2F2F2F]">Ca đã đóng</h3>
                  </div>
                  <Button variant="secondary" size="icon" aria-label="Đóng" onClick={() => setSelectedShift(null)}>
                    <X size={18} />
                  </Button>
                </div>
                <div className="mt-5 grid gap-2 sm:grid-cols-3">
                  <InfoPill label="Tổng thu" value={formatMoney(selectedShift.totalIncome as string | number | null | undefined)} />
                  <InfoPill label="Tổng chi" value={formatMoney(selectedShift.totalExpense as string | number | null | undefined)} />
                  <InfoPill label="Chênh lệch" value={formatMoney(selectedShift.difference as string | number | null | undefined)} />
                </div>
                {renderSelectedShiftTransactions()}
              </Card>
            </div>
          </Portal>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1160px] overflow-hidden rounded-[2rem] bg-[#F6F7FB] p-3 shadow-[0_24px_70px_rgba(52,64,84,0.10)] sm:p-5 lg:p-6">
      <div className="hidden">
        {rows.map((row, index) => {
          const id = String(row.id ?? "");
          const selected = id === String(activeWallet.id ?? "");
          return (
            <button
              key={id || index}
              type="button"
              onClick={() => {
                if (walletLongPressActivated) {
                  setWalletLongPressActivated(false);
                  return;
                }
                setActiveWalletId(id);
              }}
              onPointerDown={(event) => startWalletLongPress(event, id)}
              onPointerUp={clearWalletLongPress}
              onPointerCancel={clearWalletLongPress}
              onPointerLeave={clearWalletLongPress}
              className={cn(
                "flex min-w-[180px] items-center gap-3 rounded-[1.4rem] border bg-white px-3 py-3 text-left shadow-sm transition hover:-translate-y-0.5",
                selected ? "border-[#6B5BFF] ring-2 ring-[#D8D5FF]" : "border-white",
              )}
            >
              <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-2xl text-white", selected ? "bg-[#6B5BFF]" : "bg-[#D6BFA7]")}>
                <CreditCard size={18} />
              </span>
              <span className="min-w-0">
                <span className="block whitespace-normal break-words text-sm font-black text-[#2F2F2F]">{String(row.name ?? "Ví tiền")}</span>
                <span className="block text-xs font-bold text-[#7A7A7A]">{formatMoney(row.balance as string | number | null | undefined)}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(340px,0.95fr)]">
        <section className="space-y-4">
          <div className="overflow-hidden rounded-[1.8rem] border border-[#F6B6C4] bg-white shadow-[0_18px_45px_rgba(91,52,44,0.08)]">
            <div className="flex items-start justify-between gap-3 p-4 pb-3 sm:p-5 sm:pb-4">
              <div className="flex min-w-0 items-start gap-3">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#FDE8EE] text-[#EA7188] shadow-inner">
                  <WalletCards size={22} />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-[#EA7188]">Ví đang chọn</p>
                  <h2 className="mt-1 whitespace-normal break-words text-2xl font-black text-[#2F2F2F]">{String(activeWallet.name ?? "Ví tiền")}</h2>
                  <p className="mt-1 text-sm font-bold text-[#8E6E66]">{String(activeWallet.type ?? "Ví tiền")}</p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className={cn("rounded-full px-3 py-2 text-xs font-black", isActive ? "bg-emerald-50 text-emerald-700" : "bg-[#F6F7FB] text-[#7A7A7A]")}>
                  {isActive ? "Đang hoạt động" : "Tạm ngưng"}
                </span>
                {canRemove && (selectedIds.length > 0 || selectedIds.includes(String(activeWallet.id ?? ""))) ? (
                  <button
                    type="button"
                    onClick={() => onToggleSelect(String(activeWallet.id ?? ""))}
                    className={cn(
                      "grid h-9 w-9 place-items-center rounded-xl border text-xs font-black transition",
                      selectedIds.includes(String(activeWallet.id ?? "")) ? "border-[#6B5BFF] bg-[#6B5BFF] text-white shadow-[0_0_0_4px_rgba(107,91,255,0.16)] scale-105" : "border-[#E7E7E7] bg-white text-[#6B5BFF]",
                    )}
                    aria-label="Chọn ví"
                  >
                    {selectedIds.includes(String(activeWallet.id ?? "")) ? "✓" : ""}
                  </button>
                ) : null}
              </div>
            </div>
            <div className="border-t border-[#F7D5DC] bg-gradient-to-br from-[#FFF7FA] via-white to-[#F8F7FF] p-4 sm:p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-[1.35rem] bg-white p-4 shadow-sm ring-1 ring-[#F7D5DC]">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-[#B9877E]">Số dư đầu kỳ</p>
                  <p className="mt-2 whitespace-normal break-words text-3xl font-black text-[#5B342C] sm:text-4xl">
                    {formatMoney(activeWallet.openingBalance as string | number | null | undefined)}
                  </p>
                </div>
                <div className="rounded-[1.35rem] bg-white p-4 shadow-sm ring-1 ring-[#F7D5DC]">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-[#B9877E]">Số dư cuối kỳ</p>
                  <p className="mt-2 whitespace-normal break-words text-3xl font-black text-[#5B342C] sm:text-4xl">
                    {formatMoney(endingBalance as string | number | null | undefined)}
                  </p>
                </div>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <InfoPill label="Chênh lệch ca" value={`${currentShiftProfit >= 0 ? "+" : "-"}${formatMoney(Math.abs(currentShiftProfit))}`} />
                <InfoPill label="Giao dịch ca này" value={`${currentShiftTransactions.length} mục`} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <WalletStatCard icon={<ArrowDownLeft size={18} />} label="Thu ca này" value={formatMoney(currentShiftIncome)} tone="green" />
            <WalletStatCard icon={<ArrowUpRight size={18} />} label="Chi ca này" value={formatMoney(currentShiftExpense)} tone="red" />
            <WalletStatCard icon={<TrendingUp size={18} />} label="Lệch ca" value={formatMoney(currentShiftProfit)} tone="purple" />
          </div>

          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <button type="button" disabled={!openShift} onClick={onReceive} className="min-h-16 rounded-[1.4rem] bg-emerald-600 px-3 py-3 text-sm font-black text-white shadow-[0_14px_30px_rgba(16,185,129,0.22)] transition hover:-translate-y-0.5 hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0">
              <ArrowDownLeft className="mx-auto mb-1" size={20} />
              Nhận tiền
            </button>
            <button type="button" disabled={!openShift} onClick={onSpend} className="min-h-16 rounded-[1.4rem] bg-rose-600 px-3 py-3 text-sm font-black text-white shadow-[0_14px_30px_rgba(225,29,72,0.22)] transition hover:-translate-y-0.5 hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0">
              <ArrowUpRight className="mx-auto mb-1" size={20} />
              Chi tiền
            </button>
            <button type="button" disabled={!openShift} onClick={onTransfer} className="min-h-16 rounded-[1.4rem] bg-violet-600 px-3 py-3 text-sm font-black text-white shadow-[0_14px_30px_rgba(124,58,237,0.22)] transition hover:-translate-y-0.5 hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0">
              <Repeat2 className="mx-auto mb-1" size={20} />
              Chuyển tiền
            </button>
          </div>

          <Card className="rounded-[1.75rem] border-white bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-[#7A7A7A]">Ca làm việc</p>
                <h3 className="mt-1 text-2xl font-black text-[#2F2F2F]">{openShift ? "Đang hoạt động" : "Chưa mở ca"}</h3>
              </div>
              <span className={cn("rounded-full px-3 py-2 text-sm font-black", openShift ? "bg-emerald-50 text-emerald-700" : "bg-[#F6F7FB] text-[#7A7A7A]")}>
                {openShift ? "Đang hoạt động" : "Sẵn sàng mở"}
              </span>
            </div>

            <AlertModal isOpen={!!shiftMessage} message={shiftMessage} onClose={() => setShiftMessage("")} />

            {openShift ? (
              <div className="mt-4 space-y-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  <InfoPill label="Mã ca" value={String(openShift.code ?? "Đang tạo mã")} />
                  <InfoPill label="Thời gian mở ca" value={formatDateTimeLabel(openShift.openedAt)} />
                  <InfoPill label="Người mở" value={String((openShift.openedBy as Row | undefined)?.name ?? "Chưa rõ")} />
                  <InfoPill label="Tổng thu" value={formatMoney(openShift.totalIncome as string | number | null | undefined)} />
                  <InfoPill label="Tổng chi" value={formatMoney(openShift.totalExpense as string | number | null | undefined)} />
                </div>
                <Button
                  className="h-14 w-full rounded-2xl bg-rose-600 text-base font-black text-white hover:bg-rose-700"
                  onClick={() => {
                    setActualClosingBalance(String(openShift.expectedClosingBalance ?? ""));
                    setClosingOpen(true);
                  }}
                >
                  Đóng ca
                </Button>
              </div>
            ) : (
              <Button className="mt-5 h-14 w-full rounded-2xl bg-emerald-600 text-base font-black text-white hover:bg-emerald-700" onClick={() => setOpeningOpen(true)}>
                Mở ca
              </Button>
            )}

            {renderClosedShiftList()}
          </Card>

          {openingOpen ? (
            <Portal>
              <div className="fixed inset-0 z-[150] grid place-items-center bg-black/40 p-4" onClick={() => setOpeningOpen(false)}>
                <Card className="w-full max-w-md rounded-[1.75rem] border-white bg-white p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-2xl font-black text-[#2F2F2F]">Mở ca</h3>
                    <Button variant="secondary" size="icon" aria-label="Đóng" onClick={() => setOpeningOpen(false)}>
                      <X size={18} />
                    </Button>
                  </div>
                  <div className="mt-5 space-y-3">
                    <label className="block">
                      <span className="mb-2 block text-sm font-black text-[#5B342C]">Tiền đầu ca</span>
                      <Input type="number" value={openingBalance} placeholder={String(activeWallet.balance ?? "0")} onChange={(event) => setOpeningBalance(event.target.value)} />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-sm font-black text-[#5B342C]">Ghi chú mở ca</span>
                      <Input value={openingNote} placeholder="Ví dụ: ca sáng / ca tối" onChange={(event) => setOpeningNote(event.target.value)} />
                    </label>
                    <Button className="h-12 w-full rounded-2xl bg-emerald-600 text-base font-black text-white hover:bg-emerald-700" onClick={() => void openShiftNow()} disabled={isOpening}>
                      {isOpening ? <Loader2 className="animate-spin mr-2" size={18} /> : null}
                      {isOpening ? "Đang xử lý..." : "Xác nhận"}
                    </Button>
                  </div>
                </Card>
              </div>
            </Portal>
          ) : null}

          {closingOpen && openShift ? (
            <Portal>
              <div className="fixed inset-0 z-[150] grid place-items-center bg-black/40 p-4" onClick={() => setClosingOpen(false)}>
                <Card className="w-full max-w-md rounded-[1.75rem] border-white bg-white p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-2xl font-black text-[#2F2F2F]">Đóng ca</h3>
                    <Button variant="secondary" size="icon" aria-label="Đóng" onClick={() => setClosingOpen(false)}>
                      <X size={18} />
                    </Button>
                  </div>
                  <div className="mt-5 grid gap-2">
                    <InfoPill label="Tổng thu" value={formatMoney(openShift.totalIncome as string | number | null | undefined)} />
                    <InfoPill label="Tổng chi" value={formatMoney(openShift.totalExpense as string | number | null | undefined)} />
                    <InfoPill label="Số dư hệ thống" value={formatMoney(openShift.expectedClosingBalance as string | number | null | undefined)} />
                  </div>
                  <label className="mt-4 block">
                    <span className="mb-2 block text-sm font-black text-[#5B342C]">Tiền thực tế</span>
                    <Input type="number" value={actualClosingBalance} placeholder={String(openShift.expectedClosingBalance ?? "0")} onChange={(event) => setActualClosingBalance(event.target.value)} />
                  </label>
                  <div className={cn("mt-3 rounded-2xl px-4 py-3 text-sm font-black", closingDifference === 0 ? "bg-emerald-50 text-emerald-700" : "bg-orange-50 text-orange-700")}>
                    Chênh lệch: {formatMoney(closingDifference)}
                  </div>
                  <Button className="mt-4 h-12 w-full rounded-2xl bg-rose-600 text-base font-black text-white hover:bg-rose-700" onClick={() => void closeShiftNow()} disabled={isClosing}>
                    {isClosing ? <Loader2 className="animate-spin mr-2" size={18} /> : null}
                    {isClosing ? "Đang xử lý..." : "Xác nhận"}
                  </Button>
                </Card>
              </div>
            </Portal>
          ) : null}

          {deleteShiftTarget ? (
            <Portal>
              <div className="fixed inset-0 z-[150] grid place-items-center bg-black/40 p-4" onClick={() => setDeleteShiftTarget(null)}>
                <Card className="w-full max-w-md rounded-[1.75rem] border-white bg-white p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-2xl font-black text-[#2F2F2F]">Xóa ca</h3>
                    <Button variant="secondary" size="icon" aria-label="Đóng" onClick={() => setDeleteShiftTarget(null)}>
                      <X size={18} />
                    </Button>
                  </div>
                  <p className="mt-3 text-sm font-bold leading-6 text-[#7A7A7A]">
                    Nhập mật khẩu studio 6 số để xóa ca này. Mật khẩu mặc định ban đầu là 000000.
                  </p>
                  <label className="mt-4 block">
                    <span className="mb-2 block text-sm font-black text-[#5B342C]">Mật khẩu studio</span>
                    <Input type="password" inputMode="numeric" value={deleteShiftPassword} placeholder="000000" onChange={(event) => setDeleteShiftPassword(event.target.value.replace(/\D/g, "").slice(0, 6))} />
                  </label>
                  {deleteShiftMessage ? <p className="mt-3 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{deleteShiftMessage}</p> : null}
                  <Button variant="danger" className="mt-4 h-12 w-full rounded-2xl text-base font-black" onClick={() => void deleteShiftNow()} disabled={isDeleting}>
                    {isDeleting ? <Loader2 className="animate-spin mr-2" size={18} /> : null}
                    {isDeleting ? "Đang xóa..." : "Xác nhận xóa"}
                  </Button>
                </Card>
              </div>
            </Portal>
          ) : null}

          {selectedShift ? (
            <Portal>
              <div className="fixed inset-0 z-[220] grid place-items-start bg-black/45 p-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] sm:place-items-center sm:p-4" onClick={() => setSelectedShift(null)}>
                <Card className="max-h-[calc(100dvh-1.5rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] w-full max-w-3xl overflow-y-auto rounded-[1.5rem] border-white bg-white p-4 shadow-2xl sm:rounded-[1.75rem] sm:p-5" onClick={(event) => event.stopPropagation()}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.16em] text-[#EA7188]">Chi tiết ca</p>
                      <h3 className="mt-1 text-2xl font-black text-[#2F2F2F]">{String(selectedShift.code ?? "Ca đã đóng")}</h3>
                    </div>
                    <Button variant="secondary" size="icon" aria-label="Đóng" onClick={() => setSelectedShift(null)}>
                      <X size={18} />
                    </Button>
                  </div>
                  <div className="mt-5 grid gap-2 sm:grid-cols-3">
                    <InfoPill label="Người mở" value={String((selectedShift.openedBy as Row | undefined)?.name ?? "Chưa rõ")} />
                    <InfoPill label="Người đóng" value={String((selectedShift.closedBy as Row | undefined)?.name ?? "Chưa rõ")} />
                    <InfoPill label="Tiền thực tế" value={formatMoney(selectedShift.actualClosingBalance as string | number | null | undefined)} />
                    <InfoPill label="Tổng thu" value={formatMoney(selectedShift.totalIncome as string | number | null | undefined)} />
                    <InfoPill label="Tổng chi" value={formatMoney(selectedShift.totalExpense as string | number | null | undefined)} />
                    <InfoPill label="Chênh lệch" value={formatMoney(selectedShift.difference as string | number | null | undefined)} />
                  </div>
                  {renderSelectedShiftTransactions()}
                </Card>
              </div>
            </Portal>
          ) : null}

        </section>

        <section className="rounded-[1.5rem] bg-white p-3 shadow-sm sm:rounded-[2rem] sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#7A7A7A]">Lịch sử giao dịch</p>
              <h3 className="mt-1 text-xl font-black leading-tight text-[#2F2F2F] sm:text-2xl">Dòng tiền</h3>
            </div>
            <span className="shrink-0 rounded-full bg-[#F6F7FB] px-3 py-2 text-xs font-black text-[#7A7A7A] sm:text-sm">{currentShiftTransactions.length} mục</span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:gap-3">
            {currentShiftTransactions.length ? (
              walletHistoryColumns.map((column) => (
                <div key={column.key} className={cn("min-w-0 rounded-[1.25rem] border p-2 sm:rounded-[1.5rem] sm:p-3", column.panelClass)}>
                  <div className={cn("flex min-h-[4.35rem] items-center justify-between gap-2 rounded-[1rem] px-2.5 py-2 sm:px-3", column.headerClass)}>
                    <div className="min-w-0">
                      <p className="text-[11px] font-black uppercase tracking-wide opacity-80">{column.title}</p>
                      <p className="mt-0.5 truncate text-sm font-black sm:text-base">{formatMoney(column.total)}</p>
                    </div>
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-white/18">{column.icon}</span>
                  </div>

                  <div className="studio-ios-scroll mt-2 max-h-[52dvh] space-y-2 overflow-y-auto pr-0.5">
                    {column.rows.length ? (
                      column.rows.map((row, index) => {
                        const id = String(row.id ?? "");
                        return (
                          <div
                            key={id || `${column.key}-${index}`}
                            role="button"
                            tabIndex={0}
                            className="grid min-h-[5.8rem] cursor-pointer grid-rows-[auto_1fr_auto] rounded-[1rem] bg-white p-2 text-left shadow-sm ring-1 ring-black/5 transition hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#EA7188]/35 active:scale-[0.99] sm:min-h-[6.4rem] sm:p-2.5"
                            onClick={() => onOpenDetail(row)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                onOpenDetail(row);
                              }
                            }}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-xl", column.iconClass)}>
                                {column.icon}
                              </span>
                              <PrintInvoiceMenu row={row} />
                            </div>
                            <div className="min-w-0 py-1">
                              <p className="line-clamp-2 text-xs font-black leading-4 text-[#2F2F2F] sm:text-sm sm:leading-5">{String(row.title ?? "Giao dịch")}</p>
                              <p className="mt-1 truncate text-[11px] font-bold text-[#7A7A7A]">{formatDateTimeLabel(row.occurredAt ?? row.createdAt)}</p>
                            </div>
                            <p className={cn("truncate text-sm font-black sm:text-base", column.amountClass)}>{column.key === "income" ? "+" : "-"}{formatMoney(row.amount as string | number | null | undefined)}</p>
                          </div>
                        );
                      })
                    ) : (
                      <div className="grid min-h-[5.8rem] place-items-center rounded-[1rem] bg-white p-2.5 text-center text-xs font-bold text-[#7A7A7A] shadow-sm ring-1 ring-black/5 sm:min-h-[6.4rem]">
                        Chưa có khoản {column.title.toLowerCase()}
                      </div>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-2 rounded-[1.5rem] bg-[#F6F7FB] p-6 text-center">
                <WalletCards className="mx-auto text-[#7A7A7A]" size={28} />
                <p className="mt-3 text-sm font-black text-[#2F2F2F]">Chưa có giao dịch</p>
                <p className="mt-1 text-xs font-semibold text-[#7A7A7A]">Mở ca và tạo giao dịch để dòng tiền của ca hiện tại hiện ở đây.</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function WalletStatCard({ icon, label, value, tone }: { icon: ReactNode; label: string; value: string; tone: "green" | "red" | "purple" }) {
  const styles = {
    green: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    red: "bg-rose-50 text-rose-700 ring-rose-100",
    purple: "bg-violet-50 text-violet-700 ring-violet-100",
  };
  return (
    <div className={`min-w-0 rounded-[1.4rem] bg-white p-3 shadow-sm ring-1 ${styles[tone]} sm:p-4`}>
      <div className="flex items-center gap-2">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-white">{icon}</span>
        <span className="whitespace-normal break-words text-xs font-black leading-4">{label}</span>
      </div>
      <p className="mt-3 whitespace-normal break-words text-lg font-black leading-6 sm:text-xl">{value}</p>
    </div>
  );
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-2xl bg-[#FFF8F1] px-3 py-2 ring-1 ring-[#F4C7C4]">
      <p className="text-xs font-bold text-[#B98278]">{label}</p>
      <p className="mt-1 whitespace-normal break-words text-sm font-black leading-5 text-[#5B342C]">{value || "Chưa có"}</p>
    </div>
  );
}



