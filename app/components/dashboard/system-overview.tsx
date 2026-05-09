"use client";

import { useEffect, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BadgeDollarSign,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  Database,
  Download,
  FileJson,
  FileSpreadsheet,
  FileText,
  HardDrive,
  Loader2,
  PackageCheck,
  RotateCcw,
  ShieldCheck,
  UploadCloud,
  Users,
  WalletCards,
  X,
} from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { DetailModal } from "@/app/components/ui/detail-modal";
import { Card, CardTitle } from "@/app/components/ui/card";
import { StudioBrandPanel } from "@/app/components/brand/studio-brand";
import { AlertModal } from "@/app/components/ui/alert-modal";

type ImportSectionKey =
  | "categories"
  | "packages"
  | "customers"
  | "bookings"
  | "projects"
  | "wallets"
  | "transactions"
  | "invoices"
  | "employees"
  | "equipment"
  | "notifications"
  | "media";

type ImportPreview = {
  version: number | string;
  exportedAt: string | null;
  studioName: string | null;
  sections: { key: ImportSectionKey; label: string; count: number }[];
};

type ImportResult = {
  total: number;
  imported: Record<string, number>;
};

type SystemHealth = {
  database: string;
  checkedAt: string;
  tableCount: number;
  counts: {
    bookings: number;
    income: number;
    expense: number;
    transactions: number;
    invoices: number;
    customers: number;
  };
  latestBackup: { name: string; size: number; createdAt: string } | null;
};

const reports = [
  { type: "all", title: "Tất cả dữ liệu", desc: "Tổng hợp thu chi, hóa đơn, booking, dự án, ví, khách, nhân sự và thiết bị.", icon: FileSpreadsheet },
  { type: "transactions", title: "Thu chi", desc: "Khoản thu, khoản chi, ví, phương thức và trạng thái duyệt.", icon: BadgeDollarSign },
  { type: "invoices", title: "Hóa đơn", desc: "Mã hóa đơn, khách hàng, tổng tiền, đã trả và công nợ.", icon: FileText },
  { type: "bookings", title: "Booking", desc: "Khách, gói, danh mục, lịch chụp, cọc và trạng thái.", icon: CalendarDays },
  { type: "projects", title: "Dự án", desc: "Job, khách hàng, deadline, giá trị và trạng thái bàn giao.", icon: BriefcaseBusiness },
  { type: "wallets", title: "Ví / quỹ", desc: "Tiền mặt, ngân hàng, số tài khoản và số dư.", icon: WalletCards },
  { type: "customers", title: "Khách hàng", desc: "CRM khách, liên hệ, nguồn khách và tổng đã chi.", icon: Users },
  { type: "employees", title: "Nhân sự", desc: "Thông tin nhân sự, lương, lịch làm và ghi chú.", icon: Users },
  { type: "equipment", title: "Thiết bị", desc: "Thiết bị, serial, trạng thái và người đang giữ.", icon: PackageCheck },
];

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function backupFilename() {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `backup-an-toan-truoc-khoi-phuc-${stamp}.json`;
}

function formatBackupSize(size: number) {
  if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`;
  if (size >= 1024) return `${Math.round(size / 1024)} KB`;
  return `${size} B`;
}

function formatDateTime(value: string | null) {
  if (!value) return "Không rõ thời gian";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Không rõ thời gian";
  return new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

function RestoreBackupModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [backup, setBackup] = useState<unknown>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [selectedSections, setSelectedSections] = useState<ImportSectionKey[]>([]);
  const [strategy, setStrategy] = useState<"merge" | "overwrite">("merge");
  const [confirmText, setConfirmText] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState<ImportResult | null>(null);
  const [dragging, setDragging] = useState(false);

  const canImport = Boolean(backup && selectedSections.length && !loading && (strategy === "merge" || confirmText.trim().toUpperCase() === "KHOI PHUC"));

  if (!open) return null;

  async function previewFile(file: File) {
    setLoading(true);
    setMessage("");
    setSuccess(null);
    try {
      const parsed = JSON.parse(await file.text());
      const res = await fetch("/api/backup/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "preview", backup: parsed }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result?.error?.message ?? "Không đọc được file backup.");

      const nextPreview = result.data as ImportPreview;
      setFileName(file.name);
      setBackup(parsed);
      setPreview(nextPreview);
      setSelectedSections(nextPreview.sections.filter((section) => section.count > 0).map((section) => section.key));
    } catch (error) {
      setFileName("");
      setBackup(null);
      setPreview(null);
      setSelectedSections([]);
      setMessage(error instanceof Error ? error.message : "File JSON không hợp lệ.");
    } finally {
      setLoading(false);
    }
  }

  async function createSafetyBackup() {
    const res = await fetch("/api/backup", { credentials: "include" });
    if (!res.ok) throw new Error("Không tạo được bản sao lưu an toàn trước khi khôi phục.");
    downloadBlob(await res.blob(), backupFilename());
  }

  async function importBackup() {
    if (!canImport) return;
    setLoading(true);
    setSuccess(null);
    setMessage("Đang tạo bản sao lưu an toàn trước khi khôi phục...");
    try {
      await createSafetyBackup();
      setMessage("Đang khôi phục dữ liệu từ file JSON...");
      const res = await fetch("/api/backup/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "import", backup, sections: selectedSections, strategy }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result?.error?.message ?? "Không khôi phục được dữ liệu.");
      setSuccess(result.data as ImportResult);
      setMessage("Đã khôi phục dữ liệu. Tải lại trang để thấy đầy đủ thay đổi.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Khôi phục thất bại.");
    } finally {
      setLoading(false);
    }
  }

  function toggleSection(key: ImportSectionKey) {
    setSelectedSections((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key]);
  }

  return (
    <DetailModal
      onClose={onClose}
      maxWidth="max-w-4xl"
      header={
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#EA7188]">Khôi phục JSON</p>
          <h2 className="mt-1 text-2xl font-black text-[#5B342C]">Import / khôi phục dữ liệu</h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-[#9B746B]">Hệ thống sẽ tải xuống một bản backup an toàn trước khi ghi dữ liệu mới.</p>
        </div>
      }
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose}>Đóng</Button>
          {preview ? (
            <Button onClick={() => void importBackup()} disabled={!canImport}>
              {loading ? <Loader2 className="animate-spin" size={17} /> : <RotateCcw size={17} />}
              Khôi phục dữ liệu
            </Button>
          ) : null}
        </div>
      }
    >
      <div className="space-y-4">
          <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-800">
            <AlertTriangle className="mt-0.5 shrink-0" size={20} />
            <div>
              <p className="font-black">Cẩn thận khi ghi đè dữ liệu.</p>
              <p className="mt-1 text-sm font-semibold leading-6">Nên dùng “Nhập thêm / cập nhật” trước. Chế độ ghi đè sẽ xóa nhóm dữ liệu đã chọn rồi nhập lại từ file.</p>
            </div>
          </div>

          <button
            type="button"
            className={`flex min-h-44 w-full flex-col items-center justify-center rounded-[1.5rem] border-2 border-dashed p-5 text-center transition ${
              dragging ? "border-[#EA7188] bg-[#FFF0F4]" : "border-[#F4C7C4] bg-[#FFF9F4] hover:bg-[#FFF0F4]"
            }`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              const file = event.dataTransfer.files?.[0];
              if (file) void previewFile(file);
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void previewFile(file);
              }}
            />
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-[#FFE1E8] text-[#EA7188]">
              {loading && !preview ? <Loader2 className="animate-spin" size={24} /> : <UploadCloud size={24} />}
            </div>
            <p className="mt-3 text-lg font-black text-[#5B342C]">{fileName || "Kéo thả file JSON vào đây"}</p>
            <p className="mt-1 text-sm font-semibold text-[#9B746B]">Hoặc bấm để chọn file backup từ máy.</p>
          </button>

          {preview ? (
            <div className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
              <Card className="shadow-none">
                <div className="flex items-start gap-3">
                  <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#FFF0F4] text-[#EA7188]">
                    <FileJson size={22} />
                  </div>
                  <div>
                    <CardTitle>Thông tin file</CardTitle>
                    <p className="mt-1 text-sm font-semibold text-[#9B746B]">Studio: {preview.studioName || "Không rõ"}</p>
                    <p className="text-sm font-semibold text-[#9B746B]">Ngày backup: {formatDateTime(preview.exportedAt)}</p>
                    <p className="text-sm font-semibold text-[#9B746B]">Phiên bản backup: {preview.version}</p>
                  </div>
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {preview.sections.map((section) => (
                    <label
                      key={section.key}
                      className={`flex items-center justify-between gap-3 rounded-2xl border p-3 text-sm font-black transition ${
                        section.count > 0 && selectedSections.includes(section.key)
                          ? "border-[#EA7188] bg-[#FFF0F4] text-[#5B342C]"
                          : "border-[#F4C7C4] bg-white text-[#9B746B]"
                      } ${section.count === 0 ? "opacity-50" : "cursor-pointer"}`}
                    >
                      <span>{section.label}</span>
                      <span className="flex items-center gap-2">
                        <span className="rounded-full bg-white px-2 py-1 text-xs">{section.count}</span>
                        <input type="checkbox" disabled={section.count === 0} checked={selectedSections.includes(section.key)} onChange={() => toggleSection(section.key)} />
                      </span>
                    </label>
                  ))}
                </div>
              </Card>

              <Card className="shadow-none">
                <CardTitle>Kiểu khôi phục</CardTitle>
                <div className="mt-4 grid gap-3">
                  <button
                    type="button"
                    className={`rounded-2xl border p-4 text-left transition ${strategy === "merge" ? "border-[#EA7188] bg-[#FFF0F4]" : "border-[#F4C7C4] bg-white hover:bg-[#FFF9F4]"}`}
                    onClick={() => setStrategy("merge")}
                  >
                    <p className="font-black text-[#5B342C]">Nhập thêm / cập nhật</p>
                    <p className="mt-1 text-sm font-semibold text-[#9B746B]">Giữ dữ liệu hiện tại, item trùng ID sẽ được cập nhật.</p>
                  </button>
                  <button
                    type="button"
                    className={`rounded-2xl border p-4 text-left transition ${strategy === "overwrite" ? "border-rose-300 bg-rose-50" : "border-[#F4C7C4] bg-white hover:bg-[#FFF9F4]"}`}
                    onClick={() => setStrategy("overwrite")}
                  >
                    <p className="font-black text-[#5B342C]">Ghi đè nhóm đã chọn</p>
                    <p className="mt-1 text-sm font-semibold text-[#9B746B]">Xóa nhóm dữ liệu đang chọn rồi nhập lại từ file JSON.</p>
                  </button>
                </div>

                {strategy === "overwrite" ? (
                  <div className="mt-4">
                    <label className="text-sm font-black text-[#5B342C]">Nhập KHOI PHUC để xác nhận ghi đè</label>
                    <input
                      value={confirmText}
                      onChange={(event) => setConfirmText(event.target.value)}
                      className="mt-2 h-12 w-full rounded-2xl border border-[#F4C7C4] bg-[#FFF9F4] px-4 text-sm font-black text-[#5B342C] outline-none focus:border-[#EA7188] focus:ring-2 focus:ring-[#FFD4DF]"
                      placeholder="KHOI PHUC"
                    />
                  </div>
                ) : null}

                <div className="mt-5 rounded-2xl bg-[#FFF9F4] p-4">
                  <div className="flex items-center gap-2 text-sm font-black text-[#5B342C]">
                    <ShieldCheck size={17} className="text-[#EA7188]" />
                    Sẽ tự tải backup hiện tại trước khi import
                  </div>
                  <p className="mt-1 text-sm font-semibold text-[#9B746B]">Nếu import sai, vẫn còn file backup an toàn để khôi phục lại.</p>
                </div>
              </Card>
            </div>
          ) : null}

          <AlertModal isOpen={!!message} message={success ? `${message} (Tổng cộng ${success.total} mục)` : message} onClose={() => setMessage("")} />
      </div>
    </DetailModal>
  );
}

export function ReportsView() {
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [dateFilterOpen, setDateFilterOpen] = useState(false);
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);
  const [downloadingReport, setDownloadingReport] = useState<string | null>(null);
  const hasDateFilter = Boolean(fromDate || toDate);

  useEffect(() => {
    let mounted = true;
    setHealthLoading(true);
    fetch("/api/system/health")
      .then((res) => res.json())
      .then((result) => {
        if (mounted) setHealth(result.data ?? null);
      })
      .catch(() => {
        if (mounted) setHealth(null);
      })
      .finally(() => {
        if (mounted) setHealthLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  function reportHref(type: string) {
    const params = new URLSearchParams({ type });
    if (fromDate) params.set("from", fromDate);
    if (toDate) params.set("to", toDate);
    return `/api/reports?${params.toString()}`;
  }

  function useThisMonth() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
    setFromDate(`${year}-${month}-01`);
    setToDate(`${year}-${month}-${String(lastDay).padStart(2, "0")}`);
  }

  function useThisYear() {
    const year = new Date().getFullYear();
    setFromDate(`${year}-01-01`);
    setToDate(`${year}-12-31`);
  }

  return (
    <div className="space-y-5">
      <StudioBrandPanel
        eyebrow="CSV Unicode"
        title="Báo cáo"
        description="Xuất dữ liệu studio theo từng nhóm: thu chi, hóa đơn, booking, dự án, ví, khách, nhân sự và thiết bị."
        actions={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <a
              href="/api/backup"
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-[#EA7188] px-5 text-sm font-bold text-white shadow-sm transition duration-200 hover:bg-[#DA5E79] sm:w-auto"
            >
              <Download size={17} />
              Sao lưu JSON
            </a>
            <Button variant="secondary" className="min-h-11 w-full sm:w-auto" onClick={() => setRestoreOpen(true)}>
              <RotateCcw size={17} />
              Khôi phục JSON
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <div className="flex flex-col gap-4">
            <div>
              <div className="mb-3 grid h-11 w-11 place-items-center rounded-2xl bg-[#FFF0F4] text-[#EA7188]">
                <CalendarDays size={20} />
              </div>
              <CardTitle>Khoảng ngày xuất dữ liệu</CardTitle>
              <p className="mt-2 text-sm font-semibold leading-6 text-[#9B746B]">Chọn tháng, năm hoặc khoảng ngày để tránh tải dữ liệu nhiều năm một lần.</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm font-semibold text-[#9B746B]">
                {hasDateFilter ? `Đang lọc: ${fromDate || "đầu kỳ"} đến ${toDate || "hiện tại"}` : "Bộ lọc đang thu gọn."}
              </div>
              <Button
                variant={dateFilterOpen ? "primary" : "secondary"}
                className="min-h-11 w-full sm:w-auto"
                onClick={() => setDateFilterOpen((open) => !open)}
              >
                <CalendarDays size={17} />
                {dateFilterOpen ? "Thu gọn" : hasDateFilter ? "Sửa bộ lọc" : "Mở bộ lọc"}
              </Button>
            </div>
            {dateFilterOpen ? (
            <div className="grid gap-2 rounded-3xl border border-[#F4C9C5] bg-[#FFF9F4] p-3 sm:grid-cols-2 sm:p-4">
              <label className="text-sm font-bold text-[#7B554D]">
                Từ ngày
                <input
                  type="date"
                  value={fromDate}
                  onChange={(event) => setFromDate(event.target.value)}
                  className="mt-2 h-11 w-full rounded-2xl border border-[#F1C5C1] bg-[#FFF9F4] px-3 text-sm font-semibold text-[#5B342C] outline-none focus:border-[#EA7188] focus:ring-2 focus:ring-[#FFD4DF]"
                />
              </label>
              <label className="text-sm font-bold text-[#7B554D]">
                Đến ngày
                <input
                  type="date"
                  value={toDate}
                  onChange={(event) => setToDate(event.target.value)}
                  className="mt-2 h-11 w-full rounded-2xl border border-[#F1C5C1] bg-[#FFF9F4] px-3 text-sm font-semibold text-[#5B342C] outline-none focus:border-[#EA7188] focus:ring-2 focus:ring-[#FFD4DF]"
                />
              </label>
              <div className="flex flex-wrap gap-2 sm:col-span-2">
                <Button variant="secondary" size="sm" onClick={useThisMonth}>Tháng này</Button>
                <Button variant="secondary" size="sm" onClick={useThisYear}>Năm nay</Button>
                <Button variant="secondary" size="sm" onClick={() => { setFromDate(""); setToDate(""); }}>Xóa lọc</Button>
              </div>
            </div>
            ) : null}
          </div>
        </Card>

        <Card>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="mb-3 grid h-11 w-11 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
                <Activity size={20} />
              </div>
              <CardTitle>Sức khỏe hệ thống</CardTitle>
              <p className="mt-2 text-sm font-semibold text-[#9B746B]">Theo dõi nhanh database, số bảng, dữ liệu chính và backup gần nhất.</p>
            </div>
            <span className={`rounded-full px-3 py-2 text-xs font-black ${healthLoading ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-700"}`}>
              {healthLoading ? (
                <span className="inline-flex items-center gap-1.5">
                  <Loader2 size={13} className="animate-spin" />
                  Đang kiểm tra
                </span>
              ) : (health?.database ?? "Lỗi")}
            </span>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {[
              { label: "Số bảng", icon: Database, value: health?.tableCount, color: "text-[#B98278]" },
              { label: "Booking", icon: CalendarDays, value: health?.counts.bookings, color: "text-[#B98278]" },
              { label: "Thu", icon: BadgeDollarSign, value: health?.counts.income, color: "text-emerald-700" },
              { label: "Chi", icon: BadgeDollarSign, value: health?.counts.expense, color: "text-rose-700" },
              { label: "Hóa đơn", icon: FileText, value: health?.counts.invoices, color: "text-[#B98278]" },
              { label: "Khách hàng", icon: null, value: health?.counts.customers, color: "text-[#B98278]" },
            ].map((stat) => (
              <div key={stat.label} className="min-w-0 rounded-2xl bg-[#FFF3EC] p-2.5 sm:p-3">
                <p className={`flex items-center gap-2 text-xs font-black uppercase ${stat.color}`}>
                  {stat.icon ? <stat.icon size={15} /> : null}
                  {stat.label}
                </p>
                {healthLoading ? (
                  <div className="mt-2 h-5 w-10 animate-pulse rounded-lg bg-[#F4C7C4]/40" />
                ) : (
                  <p className="mt-1 text-lg font-black leading-6 text-[#5B342C] sm:text-xl">{stat.value ?? "--"}</p>
                )}
              </div>
            ))}
          </div>
          <div className="mt-3 rounded-2xl border border-[#F4C7C4] bg-white p-3 text-sm font-semibold text-[#7B554D]">
            <div className="flex items-center gap-2 font-black text-[#5B342C]"><HardDrive size={16} /> Backup gần nhất</div>
            <p className="mt-1">
              {health?.latestBackup
                ? `${health.latestBackup.name} - ${formatBackupSize(health.latestBackup.size)} - ${new Date(health.latestBackup.createdAt).toLocaleString("vi-VN")}`
                : "Chưa thấy file backup PostgreSQL trong thư mục backups."}
            </p>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {reports.map((report) => {
          const Icon = report.icon;
          return (
            <Card key={report.type} className="flex h-full flex-col">
              <div className="flex items-start gap-3">
                <div className="grid h-12 w-12 place-items-center rounded-xl bg-[#FFF3EC] text-[#EA7188]">
                  <Icon size={22} />
                </div>
                <div>
                  <CardTitle>{report.title}</CardTitle>
                  <p className="mt-2 text-sm leading-6 text-[#9B746B]">{report.desc}</p>
                </div>
              </div>
              <a
                className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-[#EA7188] px-5 text-sm font-bold text-white shadow-sm transition duration-200 hover:bg-[#DA5E79]"
                href={reportHref(report.type)}
                onClick={() => {
                  setDownloadingReport(report.type);
                  window.setTimeout(() => setDownloadingReport(null), 8000);
                }}
              >
                {downloadingReport === report.type ? (
                  <Loader2 size={17} className="animate-spin" />
                ) : (
                  <Download size={17} />
                )}
                {downloadingReport === report.type ? "Đang xuất..." : "Xuất CSV"}
              </a>
            </Card>
          );
        })}
      </div>

      <RestoreBackupModal open={restoreOpen} onClose={() => setRestoreOpen(false)} />
    </div>
  );
}
