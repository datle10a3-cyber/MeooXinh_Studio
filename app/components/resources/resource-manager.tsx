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
  MoreHorizontal,
  PawPrint,
  Repeat2,
  Save,
  Search,
  Trash2,
  TrendingUp,
  WalletCards,
  X,
} from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Card, CardTitle } from "@/app/components/ui/card";
import { DateTimeInput, Input, Textarea } from "@/app/components/ui/input";
const MediaGalleryPicker = dynamic(() => import("@/app/components/media/media-picker").then((m) => m.MediaGalleryPicker), { ssr: false });
const MediaPicker = dynamic(() => import("@/app/components/media/media-picker").then((m) => m.MediaPicker), { ssr: false });
import { ImagePreview } from "@/app/components/media/image-preview";
const BookingCalendar = dynamic(() => import("@/app/components/bookings/booking-calendar").then((m) => m.BookingCalendar), { ssr: false });
import { StudioBrandPanel } from "@/app/components/brand/studio-brand";
import { PageSpinner } from "@/app/components/ui/skeleton";
import { RESOURCE_CONFIG, type FieldConfig, type ResourceKey } from "@/app/lib/studio-config";
import { canCreate, canDelete, canMutate } from "@/app/types/auth";
import { viOption } from "@/app/lib/vietnamese-labels";
import { formatDate, formatMoney } from "@/app/utils/format";
import { cn } from "@/app/utils/cn";
import { useUiStore } from "@/app/store/ui-store";
import { navigateStudioView } from "@/app/utils/studio-navigation";
import { useProgressiveList, ProgressiveListSentinel } from "@/app/components/ui/progressive-list";

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

const RowImage = memo(function RowImage({ row, field, index }: { row: Row; field?: string; index: number }) {
  const src = field ? String(row[field] ?? "") : "";
  const image = src || fallbackImages[index % fallbackImages.length];
  return (
    <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-[1rem] border border-[#F4C7C4] bg-white sm:h-20 sm:w-20 sm:rounded-[1.35rem] lg:h-24 lg:w-24 lg:rounded-[1.5rem]">
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

function evidenceImageLabel(row: Row, resource: ResourceKey, imageIndex: number) {
  if (resource === "transactions" && !canPrintInvoice(row)) return imageIndex === 0 ? "Chứng từ" : "Ảnh phụ";
  if (["transactions", "invoices", "projects"].includes(resource) && imageIndex === 0 && !isImageLike(row.imageUrl)) return "Gói chụp";
  return imageBadgeLabel(resource, imageIndex);
}

function canPrintInvoice(row: Row) {
  const note = String(row.note ?? "");
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
  const customerName = String(snapshot?.customerName || nestedName(row.customer) || row.customerName || projectParts.customerName || "Khách hàng");
  const title = String(snapshot?.packageName || item?.description || row.packageName || projectParts.packageName || row.title || row.code || "Gói dịch vụ");
  const amount = item?.total ?? row.total ?? row.paid ?? row.amount ?? 0;
  const code = String(row.code ?? snapshot?.invoiceCode ?? noteCode ?? "meoxinh--");
  return {
    code,
    customerName,
    packageName: title.replace(/\s+-\s+Khách hàng$/i, ""),
    categoryName: String(snapshot?.categoryName ?? row.categoryName ?? "STUDIO"),
    amount,
  };
}

function cleanSystemNote(row: Row) {
  const note = String(row.note ?? "").trim();
  if (!note) return "";
  const invoiceCode = printableInvoiceData(row).code;
  const withoutReceipt = note
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
    @page{size:80mm auto;margin:0}
    @media print{html,body{width:80mm;background:#fff;color:#000}.receipt{width:80mm;margin:0;padding:8px 6px;border-color:#000}.brand-box,.total,.qr{background:#fff;border-color:#000;color:#000}.brand,.address,.title,.status{color:#000}.title{background:#fff;border:1px solid #000}.sep{border-top-color:#777}.solid{border-top-color:#000}}
  </style>
</head>
<body>
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
    <div class="info row"><span class="label">Mã HĐ</span><span class="left">: ${receiptEscape(code)}</span></div>
    <div class="info row"><span class="label">👤 Khách</span><span class="left">: ${receiptEscape(printable.customerName)}</span></div>
    <div class="info row"><span class="label">⏰ Giờ</span><span class="left">: ${receiptEscape(formatDateTimeLabel(invoiceDate))}</span></div>
    <div class="sep"></div>
    <div class="section">📸 GÓI CHỤP</div>
    <div>[${receiptEscape(printable.categoryName)}] ${receiptEscape(printable.packageName)}</div>
    <div class="sep"></div>
    <div class="section">💰 CHI TIẾT</div>
    <div class="item"><div>${receiptEscape(printable.packageName)}</div><div class="row qty"><span>x1</span><span class="right">${receiptEscape(formattedAmount)}</span></div></div>
    <div class="solid"></div>
    <div class="row bold total"><span>TỔNG TIỀN</span><span class="right">${receiptEscape(formattedAmount)}</span></div>
    <div class="sep"></div>
    <div class="status">ĐÃ THANH TOÁN ✓</div>
    ${qrBlock}
    <div class="sep"></div>
    <div class="center thanks">Cảm ơn quý khách ♥<br/><span class="bold">MÈOO XINHH STUDIO</span></div>
  </div>
  <script>window.onload=()=>{window.print();setTimeout(()=>window.close(),400);};</script>
</body>
</html>`;
  const popup = window.open("", "_blank", "width=900,height=1000");
  if (!popup) return;
  popup.document.write(html);
  popup.document.close();
}

const PrintInvoiceMenu = memo(function PrintInvoiceMenu({ row }: { row: Row }) {
  const [open, setOpen] = useState(false);

  if (!canPrintInvoice(row)) return null;

  return (
    <div className="relative shrink-0" onClick={(event) => event.stopPropagation()}>
      <Button
        variant="secondary"
        size="icon"
        aria-label="Mở lựa chọn hóa đơn"
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
        }}
      >
        <MoreHorizontal size={16} />
      </Button>
      {open ? (
        <div className="absolute right-0 z-30 mt-2 w-44 rounded-2xl border border-[#F4C7C4] bg-white p-2 shadow-xl">
          <button
            type="button"
            className="w-full rounded-xl px-3 py-2 text-left text-sm font-black text-[#5B342C] transition hover:bg-[#FFF3EC]"
            onClick={(event) => {
              event.stopPropagation();
              setOpen(false);
              printResourceInvoice(row);
            }}
          >
            In lại hóa đơn
          </button>
        </div>
      ) : null}
    </div>
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
  if (String(row.type ?? "") === "EXPENSE") return "text-rose-700";
  if (String(row.type ?? "") === "INCOME") return "text-emerald-700";
  if (resource === "projects") return "text-violet-700";
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
        "relative mt-6 cursor-pointer rounded-[1.75rem] border-[#F4C7C4] bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md active:scale-[0.99]",
        focused ? "ring-2 ring-[#EA7188]" : "",
      )}
    >
      <div className="absolute -top-3 left-5 flex gap-1.5">
        <span className="rounded-full border border-[#F4C7C4] bg-[#FFF0F4] px-3 py-1 text-[11px] font-black text-[#C14F69] shadow-sm">
          {formatDateTimeLabel(row.occurredAt ?? row.issueDate ?? row.deadlineAt ?? row.createdAt)}
        </span>
        {isTransaction ? (
          <span className={cn("rounded-full border px-3 py-1 text-[11px] font-black shadow-sm", isIncome ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700")}>
            {isIncome ? "Khoản thu" : "Khoản chi"}
          </span>
        ) : (
          <>
            {resource === "projects" && <span className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-[11px] font-black text-violet-700 shadow-sm">Dự án</span>}
            {resource === "invoices" && <span className="rounded-full border border-[#F4C7C4] bg-[#FFF3EC] px-3 py-1 text-[11px] font-black text-[#A84E61] shadow-sm">Hóa đơn</span>}
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
        <div className="flex flex-1 gap-2">
          {["invoices", "transactions"].includes(resource) ? <PrintInvoiceMenu row={row} /> : null}
          {canEdit ? (
            <Button variant="secondary" size="sm" className="min-h-10 flex-1 rounded-2xl" onClick={(event) => { event.stopPropagation(); onEdit(row); }}>
              Sửa
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
  const [submitting, setSubmitting] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);
  
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
    if (payload.error) setMessage(payload.error.message);
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

  useEffect(() => {
    if (!showForm) return;
    const frame = window.requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [showForm, resource]);

  async function save() {
    setSubmitting(true);
    try {
      const payload: Row = { ...form, ...(editingId ? { id: editingId } : {}) };
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
      setShowForm(false);
      void loadRows();
    } finally {
      setSubmitting(false);
    }
  }

  async function remove(row: Row, mode: "trash" | "hard") {
    setSubmitting(true);
    try {
      const res = await fetch(endpoint, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: row.id, mode }),
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
      void loadRows();
    } finally {
      setSubmitting(false);
    }
  }

  async function removeMany(rowsToDelete: Row[], mode: "trash" | "hard") {
    setSubmitting(true);
    try {
      for (const row of rowsToDelete) {
        const res = await fetch(endpoint, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: row.id, mode }),
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
      void loadRows();
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
    for (const field of config.fields) next[field.key] = row[field.key] ?? "";
    setForm(next);
    setEditingId(String(row.id));
    setEditStudioPassword(studioPassword);
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

  const rowGroups = resource === "transactions"
    ? [
        { title: "Khoản thu", tone: "border-emerald-100 bg-emerald-50 text-emerald-700", rows: groupedSourceRows.filter((row) => String(row.type) === "INCOME") },
        { title: "Khoản chi", tone: "border-rose-100 bg-rose-50 text-rose-700", rows: groupedSourceRows.filter((row) => String(row.type) === "EXPENSE") },
        { title: "Chuyển khoản", tone: "border-violet-100 bg-violet-50 text-violet-700", rows: groupedSourceRows.filter((row) => String(row.type) === "TRANSFER") },
      ].filter((group) => group.rows.length > 0)
    : [{ title: "", tone: "", rows: visibleRows }];

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

        {message ? <p className="rounded-2xl border border-[#F7C4CA] bg-[#FFF0F4] px-4 py-3 text-sm font-semibold text-[#A84E61]">{message}</p> : null}

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

      {message ? <p className="rounded-2xl border border-[#F7C4CA] bg-[#FFF0F4] px-4 py-3 text-sm font-semibold text-[#A84E61]">{message}</p> : null}

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

      {canMutate(session) && showForm ? (
        <div ref={formRef} className="scroll-mt-20">
        <button className="studio-mobile-form-backdrop sm:hidden" aria-label="Đóng form" onClick={() => { setEditingId(null); setForm(emptyForm(config.fields)); setShowForm(false); }} />
        <Card className="studio-mobile-form-sheet rounded-[1.5rem] border-[#F4C7C4] bg-white shadow-[0_18px_50px_rgba(184,95,108,0.1)] sm:rounded-[2rem]">
          <div className="mb-4 flex items-center justify-between gap-3">
            <CardTitle>{title}</CardTitle>
            <div className="flex shrink-0 gap-2">
              {editingId ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setEditingId(null);
                    setForm(emptyForm(config.fields));
                  }}
                >
                  Hủy sửa
                </Button>
              ) : null}
              <Button variant="secondary" size="icon" aria-label="Đóng form" onClick={() => { setEditingId(null); setForm(emptyForm(config.fields)); setShowForm(false); }}>
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

          <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
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

          <div className="studio-sticky-actions mt-5 flex justify-end">
            <Button className="w-full sm:w-auto" onClick={save} disabled={submitting}>
              {submitting ? <Loader2 className="animate-spin" size={17} /> : <Save size={17} />}
              {submitting ? "Đang lưu..." : "Lưu dữ liệu"}
            </Button>
          </div>
          {/* Thêm khoảng trống ở cuối để không bị che bởi menu/nav bar điện thoại */}
          <div className="h-20 sm:hidden" />
        </Card>
        </div>
      ) : null}

      {visibleRows.length && canDelete(session) && resource !== "wallets" ? (
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
        {initialLoading && visibleRows.length === 0 && resource !== "wallets" ? (
          <PageSpinner label={`Đang tải ${config.label}…`} />
        ) : visibleRows.length === 0 && resource !== "wallets" ? (
          <Card className="rounded-[2rem] border-[#F4C7C4] bg-white py-12 text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#FFE4EA] text-[#EA7188]">
              <ImageIcon size={22} />
            </div>
            <h2 className="mt-4 text-lg font-bold text-[#5B342C]">Chưa có dữ liệu</h2>
            <p className="mt-2 text-sm font-semibold text-[#9B746B]">Tạo bản ghi đầu tiên bằng form phía trên.</p>
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
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4">
          <Card className="w-full max-w-lg rounded-[2rem]">
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
      ) : null}
      {bulkDeleteMode ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4">
          <Card className="w-full max-w-lg rounded-[2rem]">
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
  const scrollRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.width = "100%";
    document.body.classList.add("studio-modal-open");
    return () => { 
      document.body.style.overflow = ""; 
      document.body.style.position = "";
      document.body.style.width = "";
      document.body.classList.remove("studio-modal-open");
    };
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [row.id]);

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
  const fields = detailFields(config, resource);
  const displayDetailValue = (field: string) => {
    if (resource === "transactions" && field === "walletId") {
      const wallet = walletById?.get(String(row.walletId ?? ""));
      const walletName = String(wallet?.name ?? "").trim();
      return walletName ? `${walletName} - Mèoo Xinhh Studio` : "Mèoo Xinhh Studio";
    }
    return renderValue(config, field, row[field]);
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-slate-950/45 backdrop-blur-sm touch-none">
      <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain" style={{ WebkitOverflowScrolling: "touch" }}>
        <div className="flex min-h-full justify-start p-3 sm:items-center sm:justify-center sm:p-4">
          <div className="w-full max-w-4xl rounded-[1.75rem] border border-[#F4C7C4] bg-white shadow-2xl sm:rounded-[2rem]">
            {/* Sticky header */}
            <div className="sticky top-0 z-30 flex items-start justify-between gap-3 rounded-t-[1.75rem] border-b border-[#F4C7C4] bg-white/95 px-4 py-3 backdrop-blur sm:rounded-t-[2rem] sm:px-6">
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-[#EA7188]">Chi tiết</p>
                <h2 className="mt-1 whitespace-normal break-words text-xl font-black leading-7 text-[#5B342C] sm:text-2xl">{title}</h2>
                {subtitle ? <p className="mt-1 whitespace-normal break-words text-sm font-bold leading-6 text-[#9B746B]">{subtitle}</p> : null}
              </div>
              <Button variant="secondary" size="icon" aria-label="Đóng" onClick={onClose}>
                <X size={18} />
              </Button>
            </div>

            {/* Content */}
            <div className="p-4 sm:p-6">
              {images.length ? (
                <div className="rounded-[1.5rem] bg-[#FFF8F1] p-3 ring-1 ring-[#F4C7C4]">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-[#A84E61]">Bộ ảnh</p>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-[#EA7188]">{images.length} ảnh</span>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
                    {images.map((src, index) => (
                      <button
                        key={`${String(row.id ?? "detail")}-${index}-${src}`}
                        type="button"
                        onClick={() => onOpenGallery(row, index)}
                        className="relative aspect-square overflow-hidden rounded-2xl border border-[#F4C7C4] bg-white p-1 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                      >
                        <img src={src} alt="" className="h-full w-full object-contain" />
                        <span className="absolute bottom-1 left-1 right-1 rounded-full bg-white/95 px-1.5 py-0.5 text-[10px] font-black text-[#A84E61] shadow-sm">
                          {evidenceImageLabel(row, resource, index)}
                        </span>
                      </button>
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

              <div className="mt-6 flex flex-wrap justify-end gap-2">
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

              {/* Safe area spacer for mobile */}
              <div className="h-20 sm:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom)" }} />
            </div>
          </div>
        </div>
      </div>
    </div>
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
  config: any;
  session: any;
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
                  "h-fit rounded-[1.25rem] p-2.5 transition hover:shadow-md sm:rounded-[1.5rem] sm:p-3",
                  compact ? "cursor-pointer" : "",
                  richInfoCard
                    ? "border-[#F4C7C4] bg-[linear-gradient(135deg,#FFFFFF_0%,#FFF8F1_48%,#FFF0F4_100%)] hover:-translate-y-0.5 hover:shadow-[0_18px_45px_rgba(184,95,108,0.16)]"
                    : "border-[#F4C7C4] bg-white hover:-translate-y-0.5 hover:shadow-[0_18px_45px_rgba(184,95,108,0.16)]",
                  focusedItemId === String(row.id ?? "") ? "ring-2 ring-[#EA7188]" : "",
                )}
              >
                <div className={cn("grid grid-cols-[auto_1fr_auto] items-start gap-2 sm:flex sm:flex-row md:flex-nowrap", richInfoCard ? "sm:gap-3" : "sm:gap-4")}>
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
                    <button type="button" onClick={(event) => { event.stopPropagation(); openRowGallery(row, 0); }}>
                      <RowImage row={row} field={config.imageField} index={index} />
                    </button>
                  )}
                  <div className="col-span-2 min-w-0 flex-1 sm:col-span-1">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className={cn("whitespace-normal break-words font-black leading-6 text-[#5B342C]", richInfoCard ? "text-base sm:text-lg" : "text-lg")}>{displayPrimary}</h2>
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
                      <div className={cn("mt-3 grid grid-cols-2 gap-2 sm:gap-2.5", richInfoCard ? "xl:grid-cols-4" : "sm:mt-4 sm:gap-3 xl:grid-cols-3")}>
                        {detailFields(config, resource)
                          .filter((field) => !richInfoCard || field !== config.primaryField)
                          .slice(0, richInfoCard ? 8 : 4)
                          .map((field) => {
                            const noteLike = ["note", "message"].includes(field);
                            return (
                              <div key={field} className={cn("min-w-0 rounded-2xl border border-[#F8D8D4] bg-white/78 px-2.5 py-2 shadow-sm sm:px-3", richInfoCard && noteLike ? "col-span-2 xl:col-span-2" : "")}>
                                <p className="text-[11px] font-black uppercase tracking-wide text-[#C87888]">{fieldLabel(config, field)}</p>
                                <p className={cn("mt-1 whitespace-normal break-words text-sm font-bold leading-5 text-[#5B342C]", richInfoCard && noteLike ? "max-h-16 overflow-hidden" : "")}>{renderValue(config, field, row[field])}</p>
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
                      <Button variant="secondary" size="sm" onClick={(event) => { event.stopPropagation(); edit(row); }}>
                        Sửa
                      </Button>
                      {canDelete(session) ? (
                        <Button variant="danger" size="icon" aria-label="Xóa dữ liệu" onClick={(event) => { event.stopPropagation(); setDeleteTarget(row); }}>
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

function ShiftTransactionRow({ row, index, onOpenDetail }: { row: Row; index: number; onOpenDetail: (row: Row) => void }) {
  const isIncome = String(row.type ?? "") === "INCOME";
  const amountPrefix = isIncome ? "+" : "-";

  return (
    <div
      role="button"
      tabIndex={0}
      className="group flex cursor-pointer items-start justify-between gap-3 rounded-[1.25rem] bg-[#F6F7FB] p-3 text-left transition hover:bg-white hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-[#EA7188]/35 active:scale-[0.99]"
      onClick={() => onOpenDetail(row)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpenDetail(row);
        }
      }}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-2xl", isIncome ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700")}>
          {isIncome ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="whitespace-normal break-words text-sm font-black text-[#2F2F2F]">{String(row.title ?? "Giao dịch")}</p>
            <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-black text-[#9B746B] shadow-sm">#{index + 1}</span>
          </div>
          <p className="mt-1 text-xs font-bold text-[#7A7A7A]">{formatDateTimeLabel(row.occurredAt ?? row.createdAt)}</p>
          <p className="mt-1 text-xs font-black text-[#EA7188] opacity-0 transition group-hover:opacity-100">Bấm để xem đầy đủ thông tin</p>
        </div>
      </div>
      <div className="flex shrink-0 items-start gap-2">
        <p className={cn("pt-2 text-right text-sm font-black", isIncome ? "text-emerald-700" : "text-rose-700")}>
          {amountPrefix}{formatMoney(row.amount as string | number | null | undefined)}
        </p>
        <PrintInvoiceMenu row={row} />
      </div>
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
    if (payload?.error) setShiftMessage(payload.error.message);
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
    window.scrollTo({ top: 0, behavior: "smooth" });
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

  const historyGroups = useMemo(() => {
    const groups = new Map<string, Row[]>();
    for (const row of currentShiftTransactions) {
      const label = formatDayLabel(row.occurredAt ?? row.createdAt);
      groups.set(label, [...(groups.get(label) ?? []), row]);
    }
    return Array.from(groups.entries()).map(([label, groupRows]) => ({ label, rows: groupRows.slice(0, 8) }));
  }, [currentShiftTransactions]);
  const transactionsForSelectedShift = selectedShift
    ? activeWalletTransactions.filter((row) => {
        const occurredAt = new Date(String(row.occurredAt ?? row.createdAt ?? ""));
        const openedAt = new Date(String(selectedShift.openedAt ?? ""));
        const closedAt = selectedShift.closedAt ? new Date(String(selectedShift.closedAt)) : new Date();
        return occurredAt >= openedAt && occurredAt <= closedAt;
      })
    : [];
  const closingExpected = Number(openShift?.expectedClosingBalance ?? 0);
  const closingActual = actualClosingBalance === "" ? closingExpected : Number(actualClosingBalance);
  const closingDifference = closingActual - closingExpected;

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
          {shiftMessage ? <p className="mt-3 rounded-2xl bg-[#F6F7FB] px-4 py-3 text-sm font-bold text-[#5B342C]">{shiftMessage}</p> : null}
          <Button className="mt-5 h-14 w-full rounded-2xl bg-emerald-600 text-base font-black text-white hover:bg-emerald-700" onClick={() => setOpeningOpen(true)}>
            Mở ca
          </Button>
          {renderClosedShiftList()}
        </Card>
        {openingOpen ? (
          <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
            <Card className="w-full max-w-md rounded-[1.75rem] border-white bg-white p-5 shadow-2xl">
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

          {shiftMessage ? <p className="mt-3 rounded-2xl bg-[#F6F7FB] px-4 py-3 text-sm font-bold text-[#5B342C]">{shiftMessage}</p> : null}

          <Button className="mt-5 h-14 w-full rounded-2xl bg-emerald-600 text-base font-black text-white hover:bg-emerald-700" onClick={() => setOpeningOpen(true)}>
            Mở ca
          </Button>

          {renderClosedShiftList()}
        </Card>

        {openingOpen ? (
          <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
            <Card className="w-full max-w-md rounded-[1.75rem] border-white bg-white p-5 shadow-2xl">
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
        ) : null}

        {deleteShiftTarget ? (
          <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
            <Card className="w-full max-w-md rounded-[1.75rem] border-white bg-white p-5 shadow-2xl">
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
        ) : null}

        {selectedShift ? (
          <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
            <Card className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-[1.75rem] border-white bg-white p-5 shadow-2xl">
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
              <div className="mt-5">
                <h4 className="text-base font-black text-[#2F2F2F]">Giao dịch trong ca</h4>
                {transactionsForSelectedShift.length ? (
                  <div className="mt-3 space-y-2">
                    {transactionsForSelectedShift.map((row, index) => (
                      <ShiftTransactionRow key={String(row.id ?? index)} row={row} index={index} onOpenDetail={onOpenDetail} />
                    ))}
                  </div>
                ) : (
                  <div className="mt-3 rounded-[1.5rem] bg-[#F6F7FB] p-5 text-center text-sm font-bold text-[#7A7A7A]">
                    Ca này chưa có giao dịch.
                  </div>
                )}
              </div>
            </Card>
          </div>
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

            {shiftMessage ? <p className="mt-3 rounded-2xl bg-[#F6F7FB] px-4 py-3 text-sm font-bold text-[#5B342C]">{shiftMessage}</p> : null}

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
            <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
              <Card className="w-full max-w-md rounded-[1.75rem] border-white bg-white p-5 shadow-2xl">
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
          ) : null}

          {closingOpen && openShift ? (
            <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
              <Card className="w-full max-w-md rounded-[1.75rem] border-white bg-white p-5 shadow-2xl">
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
          ) : null}

          {deleteShiftTarget ? (
            <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
              <Card className="w-full max-w-md rounded-[1.75rem] border-white bg-white p-5 shadow-2xl">
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
          ) : null}

          {selectedShift ? (
            <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
              <Card className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-[1.75rem] border-white bg-white p-5 shadow-2xl">
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
                <div className="mt-5">
                  <h4 className="text-base font-black text-[#2F2F2F]">Giao dịch trong ca</h4>
                  {transactionsForSelectedShift.length ? (
                    <div className="mt-3 space-y-2">
                      {transactionsForSelectedShift.map((row, index) => (
                        <ShiftTransactionRow key={String(row.id ?? index)} row={row} index={index} onOpenDetail={onOpenDetail} />
                      ))}
                    </div>
                  ) : (
                    <div className="mt-3 rounded-[1.5rem] bg-[#F6F7FB] p-5 text-center text-sm font-bold text-[#7A7A7A]">
                      Ca này chưa có giao dịch.
                    </div>
                  )}
                </div>
              </Card>
            </div>
          ) : null}

        </section>

        <section className="rounded-[2rem] bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#7A7A7A]">Lịch sử giao dịch</p>
              <h3 className="mt-1 text-2xl font-black text-[#2F2F2F]">Dòng tiền</h3>
            </div>
            <span className="rounded-full bg-[#F6F7FB] px-3 py-2 text-sm font-black text-[#7A7A7A]">{currentShiftTransactions.length} mục</span>
          </div>

          <div className="mt-5 space-y-5">
            {historyGroups.length ? (
              historyGroups.map((group) => (
                <div key={group.label} className="space-y-2">
                  <p className="text-sm font-black text-[#7A7A7A]">{group.label}</p>
                  <div className="space-y-2">
                    {group.rows.map((row, index) => {
                      const id = String(row.id ?? "");
                      const isIncome = String(row.type ?? "") === "INCOME";
                      return (
                        <div
                          key={id || `${group.label}-${index}`}
                          className="flex cursor-pointer items-start gap-3 rounded-[1.35rem] bg-[#F6F7FB] p-3 transition hover:bg-white hover:shadow-sm"
                          onClick={() => onOpenDetail(row)}
                        >
                          <div className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-2xl", isIncome ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700")}>
                            {isIncome ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="inline-flex rounded-full bg-white px-2.5 py-1 text-[11px] font-black text-[#9B746B] shadow-sm">
                              {formatDateTimeLabel(row.occurredAt ?? row.createdAt)}
                            </span>
                            <p className="whitespace-normal break-words text-sm font-black leading-5 text-[#2F2F2F]">{String(row.title ?? "Giao dịch")}</p>
                            <p className="mt-0.5 text-xs font-bold text-[#7A7A7A]">
                              Tạo: {formatDateTimeLabel(row.createdAt)} · Phát sinh: {formatDateTimeLabel(row.occurredAt)} · {viOption(row.approvalStatus)}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <p className={cn("text-right text-sm font-black", isIncome ? "text-emerald-700" : "text-rose-700")}>
                              {isIncome ? "+" : "-"}{formatMoney(row.amount as string | number | null | undefined)}
                            </p>
                            <PrintInvoiceMenu row={row} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-[1.5rem] bg-[#F6F7FB] p-6 text-center">
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



