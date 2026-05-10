"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, ImagePlus, Library, LinkIcon, Star, Trash2, Upload, X } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { cn } from "@/app/utils/cn";
import { Portal } from "@/app/components/ui/portal";

type MediaItem = {
  id: string;
  url: string;
  filename: string;
};

type MediaPage = {
  items: MediaItem[];
  nextCursor: string | null;
  hasMore: boolean;
};

function parseGallery(value?: string | null) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string").slice(0, 4) : [];
  } catch {
    return [];
  }
}

function stringifyGallery(urls: string[]) {
  return JSON.stringify(urls.filter(Boolean).slice(0, 4));
}

export function MediaPicker({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return <ImageSlot value={value} title="Ảnh" onChange={onChange} placeholder={placeholder} />;
}

export function MediaGalleryPicker({
  mainUrl,
  galleryUrls,
  onMainChange,
  onGalleryChange,
}: {
  mainUrl: string;
  galleryUrls?: string | null;
  onMainChange: (value: string) => void;
  onGalleryChange: (value: string) => void;
}) {
  const gallery = parseGallery(galleryUrls);

  function updateGallery(index: number, url: string) {
    const next = [...gallery];
    next[index] = url;
    onGalleryChange(stringifyGallery(next));
  }

  return (
    <div className="rounded-2xl border border-[#F4C7C4] bg-white p-3 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-[#5B342C]">Bộ ảnh</p>
          <p className="text-xs text-[#9B746B]">1 ảnh chính + 4 ảnh phụ.</p>
        </div>
        <span className="rounded-full bg-[#FFF3EC] px-3 py-1 text-xs font-bold text-[#9B746B]">
          {(mainUrl ? 1 : 0) + gallery.filter(Boolean).length}/5
        </span>
      </div>

      <ImageSlot value={mainUrl} title="Ảnh chính" featured onChange={onMainChange} />

      <div className="mt-3 grid grid-cols-4 gap-2">
        {[0, 1, 2, 3].map((index) => (
          <ImageSlot
            key={index}
            value={gallery[index] ?? ""}
            title={`${index + 1}`}
            compact
            onChange={(value) => updateGallery(index, value)}
          />
        ))}
      </div>
    </div>
  );
}

function ImageSlot({
  value,
  title,
  onChange,
  placeholder,
  compact,
  featured,
}: {
  value: string;
  title: string;
  onChange: (value: string) => void;
  placeholder?: string;
  compact?: boolean;
  featured?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function upload(file?: File) {
    if (!file) return;
    setUploading(true);
    
    let finalFile = file;
    if (file.type.startsWith("image/") && !file.type.includes("svg")) {
      try {
        const img = document.createElement("img");
        const url = URL.createObjectURL(file);
        
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
          img.src = url;
        });
        
        URL.revokeObjectURL(url);
        
        let width = img.width;
        let height = img.height;
        const MAX_SIZE = 1920;
        
        if (width > MAX_SIZE || height > MAX_SIZE) {
          if (width > height) {
            height = Math.round((height * MAX_SIZE) / width);
            width = MAX_SIZE;
          } else {
            width = Math.round((width * MAX_SIZE) / height);
            height = MAX_SIZE;
          }
        }
        
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
          if (blob) {
            finalFile = new File([blob], file.name.replace(/\.[^/.]+$/, ".jpg"), {
              type: "image/jpeg",
              lastModified: Date.now(),
            });
          }
        }
      } catch (e) {
        console.error("Compression failed", e);
      }
    }

    const form = new FormData();
    form.append("file", finalFile);
    const result = await fetch("/api/media", { method: "POST", body: form })
      .then((res) => res.json())
      .catch(() => null);
    if (result?.data?.url) onChange(result.data.url);
    setUploading(false);
  }

  return (
    <div className="relative space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wide text-[#9B746B]">
          {compact ? `Phụ ${title}` : title}
        </span>
        {featured ? <Star size={14} className="fill-[#EA7188] text-[#EA7188]" /> : null}
      </div>

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={cn(
          "group relative grid w-full place-items-center rounded-xl border border-dashed border-[#EA7188] bg-[#FFF9F4] text-[#B98278] transition hover:border-[#EA7188] hover:bg-white",
          compact ? "min-h-24 p-2" : value ? "min-h-32 p-3" : "h-32",
        )}
      >
        {value ? (
          <img
            src={value}
            alt=""
            className={cn("object-contain", compact ? "max-h-36 max-w-full" : "max-h-64 max-w-full")}
          />
        ) : (
          <div className="text-center">
            <ImagePlus className="mx-auto" size={compact ? 18 : 26} />
            <p className="mt-1 text-xs font-semibold">{compact ? "Chọn" : "Chọn ảnh"}</p>
          </div>
        )}
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => void upload(event.target.files?.[0])}
      />

      <div className={cn("flex gap-2", compact ? "grid grid-cols-2" : "flex-wrap")}>
        <Button
          variant="secondary"
          size="sm"
          type="button"
          className={compact ? "px-2 text-xs" : ""}
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          <Upload size={14} />
          {uploading ? "Tải" : compact ? "" : "Upload"}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          type="button"
          className={compact ? "px-2 text-xs" : ""}
          onClick={() => setLibraryOpen(true)}
        >
          <Library size={14} />
          {compact ? "" : "Thư viện"}
        </Button>
        {!compact ? (
          <Button variant="ghost" size="sm" type="button" onClick={() => setLinkOpen(!linkOpen)}>
            <LinkIcon size={14} />
            Link
          </Button>
        ) : null}
        {value && !compact ? (
          <Button variant="ghost" size="sm" type="button" onClick={() => onChange("")}>
            Bỏ ảnh
          </Button>
        ) : null}
      </div>

      {linkOpen && !compact ? (
        <Input
          value={value}
          placeholder={placeholder ?? "Dán link ảnh nếu cần"}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : null}

      <MediaLibraryModal
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        onPick={(url) => {
          onChange(url);
          setLibraryOpen(false);
        }}
      />
    </div>
  );
}

function MediaLibraryModal({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (url: string) => void }) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectionMode, setSelectionMode] = useState(false);
  const longPressTimer = useRef<number | null>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const longPressActivated = useRef(false);

  const loadMedia = useCallback(async (mode: "reset" | "append" = "reset") => {
    if (mode === "append" && !nextCursor) return;
    setLoading(true);
    const params = new URLSearchParams({ cursorMode: "1", take: "72" });
    if (mode === "append" && nextCursor) params.set("cursor", nextCursor);
    const result = await fetch(`/api/media?${params.toString()}`)
      .then((res) => res.json())
      .catch(() => null);
    if (result?.data) {
      const page = result.data as MediaPage;
      setItems((current) => {
        if (mode === "reset") return page.items;
        const seen = new Set(current.map((item) => item.id));
        return [...current, ...page.items.filter((item) => !seen.has(item.id))];
      });
      setNextCursor(page.nextCursor);
      setHasMore(page.hasMore);
    }
    setLoading(false);
  }, [nextCursor]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      setSelectedIds([]);
      setSelectionMode(false);
      void loadMedia("reset");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadMedia, open]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose, open]);

  function clearLongPress() {
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function beginLongPress(id: string) {
    clearLongPress();
    longPressTimer.current = window.setTimeout(() => {
      longPressActivated.current = true;
      setSelectionMode(true);
      setSelectedIds((current) => (current.includes(id) ? current : [...current, id]));
      longPressTimer.current = null;
    }, 450);
  }

  async function deleteSelected(all = false) {
    const count = all ? items.length : selectedIds.length;
    if (!count) return;
    const confirmed = window.confirm(all ? "Xóa tất cả ảnh trong thư viện?" : `Xóa ${count} ảnh đã chọn?`);
    if (!confirmed) return;
    await fetch("/api/media", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(all ? { all: true } : { ids: selectedIds }),
    });
    setSelectedIds([]);
    setSelectionMode(false);
    await loadMedia("reset");
  }

  if (!open) return null;

  return (
    <Portal>
      <div className="fixed inset-0 z-[150] bg-[#2F1E1A]/55 p-2 pt-[max(env(safe-area-inset-top),0.75rem)] backdrop-blur-sm sm:p-5" onClick={onClose}>
        <div
          className="mx-auto flex h-[calc(100dvh_-_1.5rem_-_env(safe-area-inset-top))] max-w-6xl flex-col overflow-hidden rounded-[1.35rem] border border-[#F4C7C4] bg-white shadow-[0_20px_60px_rgba(91,52,44,0.28)] sm:h-[calc(100vh-2.5rem)] sm:rounded-[2rem]"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="sticky top-0 z-30 border-b border-[#F4C7C4] bg-white px-3 py-3 shadow-sm backdrop-blur sm:flex sm:items-center sm:justify-between sm:gap-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-[#EA7188]">Thư viện ảnh</p>
                <h2 className="truncate text-xl font-black text-[#5B342C] sm:text-2xl">{items.length} ảnh</h2>
                <p className="mt-0.5 text-[11px] font-bold text-[#9B746B] sm:text-xs">Nhấn giữ ảnh để chọn nhiều ảnh.</p>
              </div>
              <Button variant="secondary" size="icon" className="shrink-0 sm:hidden" aria-label="Đóng thư viện ảnh" onClick={onClose}>
                <X size={18} />
              </Button>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:mt-0 sm:flex sm:flex-wrap">
              {selectionMode ? (
                <>
                  <Button variant="secondary" size="sm" className="min-h-12 rounded-2xl text-sm" onClick={() => setSelectedIds(items.map((item) => item.id))}>
                    Chọn trang
                  </Button>
                  <Button variant="secondary" size="sm" className="min-h-12 rounded-2xl text-sm" onClick={() => { setSelectionMode(false); setSelectedIds([]); }}>
                    Bỏ chọn
                  </Button>
                  <Button variant="danger" size="sm" className="min-h-12 rounded-2xl text-sm" disabled={!selectedIds.length} onClick={() => void deleteSelected(false)}>
                    <Trash2 size={15} />
                    Xóa ({selectedIds.length})
                  </Button>
                </>
              ) : (
                <Button variant="secondary" size="sm" className="min-h-12 rounded-2xl text-sm" onClick={() => setSelectionMode(true)}>
                  Chọn
                </Button>
              )}
              <Button variant="danger" size="sm" className="min-h-12 rounded-2xl text-sm" disabled={!items.length} onClick={() => void deleteSelected(true)}>
                Xóa tất cả
              </Button>
              <Button variant="secondary" size="icon" className="hidden sm:grid" aria-label="Đóng thư viện ảnh" onClick={onClose}>
                <X size={18} />
              </Button>
            </div>
          </div>

          <div className="studio-ios-scroll flex-1 overflow-y-auto bg-[#FFF8F1] p-2 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-5">
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-7">
              {items.map((item) => {
                const selected = selectedIds.includes(item.id);
                return (
                  <div
                    key={item.id}
                    role="button"
                    tabIndex={0}
                    className={cn(
                      "group relative touch-pan-y select-none overflow-hidden rounded-xl border bg-white p-1.5 shadow-sm transition active:scale-[0.98]",
                      selected ? "border-[#EA7188] ring-4 ring-[#EA7188]/20" : "border-[#F4C7C4] hover:border-[#EA7188]",
                    )}
                    onClick={() => {
                      if (longPressActivated.current) {
                        longPressActivated.current = false;
                        return;
                      }
                      if (selectionMode) toggleSelect(item.id);
                      else onPick(item.url);
                    }}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter" && event.key !== " ") return;
                      event.preventDefault();
                      if (selectionMode) toggleSelect(item.id);
                      else onPick(item.url);
                    }}
                    onPointerDown={(event) => {
                      pointerStart.current = { x: event.clientX, y: event.clientY };
                      beginLongPress(item.id);
                    }}
                    onPointerMove={(event) => {
                      if (!pointerStart.current) return;
                      if (Math.abs(event.clientX - pointerStart.current.x) > 12 || Math.abs(event.clientY - pointerStart.current.y) > 12) {
                        pointerStart.current = null;
                        clearLongPress();
                      }
                    }}
                    onPointerUp={() => {
                      pointerStart.current = null;
                      clearLongPress();
                    }}
                    onPointerCancel={clearLongPress}
                    onPointerLeave={clearLongPress}
                    onTouchMove={(event) => {
                      if (!touchStart.current) return;
                      const touch = event.touches[0];
                      if (Math.abs(touch.clientX - touchStart.current.x) > 12 || Math.abs(touch.clientY - touchStart.current.y) > 12) {
                        touchStart.current = null;
                        clearLongPress();
                      }
                    }}
                    onTouchEnd={() => {
                      touchStart.current = null;
                      clearLongPress();
                    }}
                  >
                    {selectionMode || selected ? (
                      <span
                        className={cn(
                          "absolute left-3 top-3 z-10 grid h-8 w-8 place-items-center rounded-full border text-xs font-black shadow",
                          selected ? "border-[#EA7188] bg-[#EA7188] text-white" : "border-[#F4C7C4] bg-white text-[#EA7188]",
                        )}
                      >
                        {selected ? <Check size={15} /> : null}
                      </span>
                    ) : null}
                    <img src={item.url} alt={item.filename} className="h-24 w-full rounded-lg object-cover sm:h-28" />
                    <p className="mt-1 truncate text-[11px] font-bold text-[#8C655E]" title={item.filename}>
                      {item.filename}
                    </p>
                  </div>
                );
              })}
            </div>
            {!items.length && !loading ? (
              <div className="grid min-h-64 place-items-center rounded-2xl border border-dashed border-[#F4C7C4] bg-white text-sm font-bold text-[#9B746B]">
                Chưa có ảnh trong thư viện.
              </div>
            ) : null}
            {hasMore ? (
              <Button type="button" variant="secondary" className="mt-5 w-full" disabled={loading} onClick={() => void loadMedia("append")}>
                {loading ? "Đang tải..." : "Xem thêm ảnh"}
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </Portal>
  );
}
