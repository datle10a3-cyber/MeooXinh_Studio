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
    const frame = window.requestAnimationFrame(() => setMounted(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  // Back gesture / browser back button history listener
  useEffect(() => {
    const previewId = Math.random().toString(36).substring(2, 9);
    const stateKey = `preview-${previewId}`;
    
    window.history.pushState({ stateKey }, "");

    const handlePopState = (event: PopStateEvent) => {
      if (event.state?.stateKey !== stateKey) {
        onCloseRef.current();
      }
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
      if (window.history.state?.stateKey === stateKey) {
        window.history.back();
      }
    };
  }, []);  const list = images?.length ? images : src ? [src] : [];
  const currentIndex = Math.min(Math.max(index, 0), Math.max(list.length - 1, 0));
  const currentSrc = list[currentIndex];
  const canSlide = list.length > 1 && onIndexChange;

  function move(step: number) {
    if (!canSlide) return;
    onIndexChange((currentIndex + step + list.length) % list.length);
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        move(-1);
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        move(1);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  if (!currentSrc) return null;

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
      className="fixed inset-0 z-[420] overflow-y-auto overscroll-contain bg-[radial-gradient(circle_at_top,#5B342C_0%,#2B1C1A_42%,#120B0B_100%)] p-2 backdrop-blur-xl sm:p-4"
      onClick={handleBackdropClick}
      onWheel={handleWheel}
    >
      <div className="mx-auto flex min-h-full max-w-7xl flex-col justify-center gap-3 py-2 sm:gap-4 sm:py-4" onClick={(event) => event.stopPropagation()} onWheel={handleWheel}>
        <div className="sticky top-2 z-20 flex items-center justify-between rounded-[1.5rem] border border-white/15 bg-white/[0.13] px-3 py-2 text-white shadow-[0_18px_70px_rgba(0,0,0,0.35)] backdrop-blur-2xl sm:static sm:rounded-full sm:px-4">
          <div className="min-w-0">
            <p className="truncate text-sm font-black">{alt || "Ảnh xem trước"}</p>
            <p className="text-xs font-semibold text-white/70">
              {currentIndex + 1} / {list.length}
            </p>
          </div>
          <Button variant="secondary" size="icon" className="h-10 w-10 rounded-full border border-white/80 bg-white text-[#5B342C] shadow-lg transition hover:-translate-y-0.5 hover:bg-[#FFF8F1] active:scale-95" aria-label="Đóng ảnh" onClick={onClose}>
            <X size={18} />
          </Button>
        </div>

        <div
          className="relative touch-pan-y select-none overflow-hidden rounded-[1.75rem] border border-white/25 bg-[linear-gradient(135deg,rgba(255,250,246,0.98),rgba(255,239,246,0.92))] shadow-[0_35px_120px_rgba(0,0,0,0.48)] ring-1 ring-white/20 sm:rounded-[2.25rem]"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onWheel={handleWheel}
        >
          {canSlide ? (
            <>
              <Button className="absolute left-2 top-1/2 z-10 h-11 w-11 -translate-y-1/2 rounded-full border border-white/70 bg-white/80 text-[#5B342C]/65 shadow-[0_12px_35px_rgba(91,52,44,0.18)] backdrop-blur-xl transition hover:-translate-x-0.5 hover:bg-white hover:text-[#5B342C] active:scale-95 sm:left-5 sm:h-12 sm:w-12" variant="secondary" size="icon" aria-label="Ảnh trước" onClick={() => move(-1)}>
                <ChevronLeft size={22} />
              </Button>
              <Button className="absolute right-2 top-1/2 z-10 h-11 w-11 -translate-y-1/2 rounded-full border border-white/70 bg-white/80 text-[#5B342C]/65 shadow-[0_12px_35px_rgba(91,52,44,0.18)] backdrop-blur-xl transition hover:translate-x-0.5 hover:bg-white hover:text-[#5B342C] active:scale-95 sm:right-5 sm:h-12 sm:w-12" variant="secondary" size="icon" aria-label="Ảnh sau" onClick={() => move(1)}>
                <ChevronRight size={22} />
              </Button>
            </>
          ) : null}
          <div className="grid max-h-[calc(100dvh-11rem)] min-h-[260px] w-full place-items-center overflow-hidden p-3 sm:min-h-[360px] sm:max-h-[72vh] sm:p-6" onWheel={handleWheel}>
            <img src={currentSrc} alt={alt ?? ""} draggable={false} className="block h-auto max-h-[calc(100dvh-13rem)] w-auto max-w-full rounded-[1.25rem] object-contain shadow-[0_18px_55px_rgba(91,52,44,0.2)] ring-1 ring-white/80 sm:max-h-[68vh] sm:rounded-[1.5rem]" />
          </div>
        </div>

        {list.length > 1 ? (
          <div className="mx-auto flex max-h-28 max-w-full gap-2 overflow-x-auto overflow-y-hidden overscroll-x-contain rounded-[1.5rem] border border-white/20 bg-white/[0.16] p-2 shadow-[0_22px_70px_rgba(0,0,0,0.38)] backdrop-blur-2xl [-ms-overflow-style:none] [scrollbar-width:none] sm:max-h-32 sm:gap-3 sm:rounded-[1.75rem] sm:p-3 [&::-webkit-scrollbar]:hidden">
            {list.map((url, itemIndex) => (
              <button
                key={`${url}-${itemIndex}`}
                type="button"
                onClick={() => onIndexChange?.(itemIndex)}
                className={cn(
                  "grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-2xl border bg-white/90 p-1.5 shadow-sm transition hover:-translate-y-0.5 hover:scale-[1.03]",
                  itemIndex === currentIndex ? "border-[#EA7188] ring-4 ring-[#EA7188]/35" : "border-white/70 opacity-80 hover:opacity-100",
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
