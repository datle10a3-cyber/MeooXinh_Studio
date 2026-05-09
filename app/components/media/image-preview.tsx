"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { cn } from "@/app/utils/cn";

export function ImagePreview({
  src,
  alt,
  images,
  index = 0,
  onIndexChange,
  onClose,
}: {
  src?: string | null;
  alt?: string;
  images?: string[];
  index?: number;
  onIndexChange?: (index: number) => void;
  onClose: () => void;
}) {
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const touchIntent = useRef<"horizontal" | "vertical" | null>(null);
  const touchMoved = useRef(false);
  const lastWheelAt = useRef(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const list = images?.length ? images : src ? [src] : [];
  const currentIndex = Math.min(Math.max(index, 0), Math.max(list.length - 1, 0));
  const currentSrc = list[currentIndex];
  const canSlide = list.length > 1 && onIndexChange;

  if (!currentSrc) return null;

  function move(step: number) {
    if (!canSlide) return;
    onIndexChange((currentIndex + step + list.length) % list.length);
  }

  function handleTouchStart(event: React.TouchEvent<HTMLDivElement>) {
    const touch = event.touches[0];
    touchStartX.current = touch.clientX;
    touchStartY.current = touch.clientY;
    touchIntent.current = null;
    touchMoved.current = false;
  }

  function handleTouchMove(event: React.TouchEvent<HTMLDivElement>) {
    if (!canSlide || touchStartX.current === null || touchStartY.current === null) return;

    const touch = event.touches[0];
    const deltaX = touch.clientX - touchStartX.current;
    const deltaY = touch.clientY - touchStartY.current;
    if (Math.abs(deltaX) > 8 || Math.abs(deltaY) > 8) touchMoved.current = true;

    if (!touchIntent.current && (Math.abs(deltaX) > 12 || Math.abs(deltaY) > 12)) {
      touchIntent.current = Math.abs(deltaX) > Math.abs(deltaY) * 1.15 ? "horizontal" : "vertical";
    }

    if (touchIntent.current === "horizontal" && event.cancelable) {
      event.preventDefault();
    }
  }

  function handleTouchEnd(event: React.TouchEvent<HTMLDivElement>) {
    if (!canSlide || touchStartX.current === null || touchStartY.current === null) {
      touchStartX.current = null;
      touchStartY.current = null;
      touchIntent.current = null;
      return;
    }

    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - touchStartX.current;
    const deltaY = touch.clientY - touchStartY.current;
    touchStartX.current = null;
    touchStartY.current = null;
    touchIntent.current = null;

    if (Math.abs(deltaX) < 52 || Math.abs(deltaX) < Math.abs(deltaY) * 1.35) return;
    move(deltaX < 0 ? 1 : -1);
  }

  function handleWheel(event: React.WheelEvent<HTMLDivElement>) {
    if (!canSlide) return;
    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    if (Math.abs(delta) < 18) return;

    const now = Date.now();
    if (now - lastWheelAt.current < 260) return;
    lastWheelAt.current = now;
    event.preventDefault();
    event.stopPropagation();
    move(delta > 0 ? 1 : -1);
  }

  function handleBackdropClick() {
    if (touchMoved.current) {
      touchMoved.current = false;
      return;
    }
    onClose();
  }

  if (!mounted || !currentSrc) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[120] overflow-y-auto overscroll-contain bg-[#2B1C1A]/80 p-2 backdrop-blur-md sm:p-4"
      onClick={handleBackdropClick}
      onWheel={handleWheel}
    >
      <div className="mx-auto flex min-h-full max-w-6xl flex-col justify-center gap-3 py-2 sm:gap-4 sm:py-4" onClick={(event) => event.stopPropagation()} onWheel={handleWheel}>
        <div className="sticky top-2 z-20 flex items-center justify-between rounded-full border border-white/15 bg-white/10 px-3 py-2 text-white shadow-2xl backdrop-blur sm:static">
          <div className="min-w-0">
            <p className="truncate text-sm font-black">{alt || "Ảnh xem trước"}</p>
            <p className="text-xs font-semibold text-white/70">
              {currentIndex + 1} / {list.length}
            </p>
          </div>
          <Button variant="secondary" size="icon" className="h-10 w-10 rounded-full bg-white text-[#5B342C]" aria-label="Đóng ảnh" onClick={onClose}>
            <X size={18} />
          </Button>
        </div>

        <div
          className="relative touch-pan-y select-none overflow-hidden rounded-[1.5rem] border border-white/20 bg-[#FFF9F4] shadow-[0_30px_100px_rgba(0,0,0,0.35)] sm:rounded-[2rem]"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onWheel={handleWheel}
        >
          {canSlide ? (
            <>
              <Button className="absolute left-2 top-1/2 z-10 h-10 w-10 -translate-y-1/2 rounded-full border-white/35 bg-white/20 text-[#5B342C]/45 shadow-md backdrop-blur transition hover:bg-white/55 hover:text-[#5B342C]/80 active:scale-95 sm:left-4 sm:h-12 sm:w-12 sm:bg-white/30" variant="secondary" size="icon" aria-label="Ảnh trước" onClick={() => move(-1)}>
                <ChevronLeft size={22} />
              </Button>
              <Button className="absolute right-2 top-1/2 z-10 h-10 w-10 -translate-y-1/2 rounded-full border-white/35 bg-white/20 text-[#5B342C]/45 shadow-md backdrop-blur transition hover:bg-white/55 hover:text-[#5B342C]/80 active:scale-95 sm:right-4 sm:h-12 sm:w-12 sm:bg-white/30" variant="secondary" size="icon" aria-label="Ảnh sau" onClick={() => move(1)}>
                <ChevronRight size={22} />
              </Button>
            </>
          ) : null}
          <div className="grid max-h-[calc(100dvh-11.5rem)] min-h-[220px] w-full place-items-center overflow-hidden p-2 sm:min-h-[260px] sm:max-h-[70vh] sm:p-5" onWheel={handleWheel}>
            <img src={currentSrc} alt={alt ?? ""} draggable={false} className="block h-auto max-h-[calc(100dvh-13rem)] w-auto max-w-full rounded-[1rem] object-contain sm:max-h-[66vh] sm:rounded-[1.25rem]" />
          </div>
        </div>

        {list.length > 1 ? (
          <div className="mx-auto flex max-h-28 max-w-full gap-2 overflow-x-auto overflow-y-hidden overscroll-x-contain rounded-[1.25rem] border border-white/15 bg-white/10 p-2 shadow-2xl [-ms-overflow-style:none] [scrollbar-width:none] sm:max-h-32 sm:gap-3 sm:rounded-[1.5rem] sm:p-3 [&::-webkit-scrollbar]:hidden">
            {list.map((url, itemIndex) => (
              <button
                key={`${url}-${itemIndex}`}
                type="button"
                onClick={() => onIndexChange?.(itemIndex)}
                className={cn(
                  "grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-2xl border bg-white/90 p-1 transition hover:scale-105",
                  itemIndex === currentIndex ? "border-[#EA7188] ring-4 ring-[#EA7188]/30" : "border-white/50",
                )}
              >
                <img src={url} alt="" draggable={false} className="max-h-full max-w-full object-contain" />
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>,
    document.body
  );
}
