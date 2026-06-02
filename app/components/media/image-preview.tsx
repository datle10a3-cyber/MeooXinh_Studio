"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  const thumbnailRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [mounted, setMounted] = useState(false);
  const [slideDirection, setSlideDirection] = useState<"next" | "prev" | "fade">("fade");
  const [dragOffset, setDragOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [settlingDrag, setSettlingDrag] = useState(false);

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
  }, []);
  const list = useMemo(() => (images?.length ? images : src ? [src] : []), [images, src]);
  const currentIndex = Math.min(Math.max(index, 0), Math.max(list.length - 1, 0));
  const currentSrc = list[currentIndex];
  const canSlide = list.length > 1 && onIndexChange;
  const progressPercent = list.length ? ((currentIndex + 1) / list.length) * 100 : 0;

  useEffect(() => {
    if (!mounted || list.length <= 1) return;
    const frame = window.requestAnimationFrame(() => {
      thumbnailRefs.current[currentIndex]?.scrollIntoView({
        behavior: window.matchMedia("(pointer: coarse)").matches ? "auto" : "smooth",
        block: "nearest",
        inline: "center",
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [currentIndex, list.length, mounted]);

  useEffect(() => {
    if (!mounted || !list.length) return;
    const preloadIndexes = [currentIndex, currentIndex - 1, currentIndex + 1, currentIndex + 2];
    const seen = new Set<string>();
    preloadIndexes.forEach((itemIndex) => {
      const url = list[(itemIndex + list.length) % list.length];
      if (!url || seen.has(url)) return;
      seen.add(url);
      const image = new window.Image();
      image.decoding = "async";
      image.src = url;
    });
  }, [currentIndex, list, mounted]);

  function move(step: number) {
    if (!canSlide) return;
    setSlideDirection(step > 0 ? "next" : "prev");
    setDragOffset(0);
    setDragging(false);
    setSettlingDrag(false);
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
    setDragOffset(0);
    setDragging(false);
    setSettlingDrag(false);
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
      setDragging(true);
      setDragOffset(Math.max(-120, Math.min(120, deltaX * 0.42)));
    }
  }

  function handleTouchEnd(event: React.TouchEvent<HTMLDivElement>) {
    if (!canSlide || touchStartX.current === null || touchStartY.current === null) {
      touchStartX.current = null;
      touchStartY.current = null;
      touchIntent.current = null;
      setDragOffset(0);
      setDragging(false);
      setSettlingDrag(false);
      return;
    }

    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - touchStartX.current;
    const deltaY = touch.clientY - touchStartY.current;
    touchStartX.current = null;
    touchStartY.current = null;
    touchIntent.current = null;

    if (Math.abs(deltaX) < 52 || Math.abs(deltaX) < Math.abs(deltaY) * 1.35) {
      setSettlingDrag(true);
      setDragOffset(0);
      window.setTimeout(() => {
        setDragging(false);
        setSettlingDrag(false);
      }, 180);
      return;
    }
    setDragOffset(0);
    setDragging(false);
    setSettlingDrag(false);
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

  function selectImage(itemIndex: number) {
    if (!onIndexChange || itemIndex === currentIndex) return;
    setSlideDirection(itemIndex > currentIndex ? "next" : "prev");
    setDragOffset(0);
    setDragging(false);
    setSettlingDrag(false);
    onIndexChange(itemIndex);
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
      className="fixed inset-0 z-[420] overflow-hidden overscroll-contain bg-[radial-gradient(circle_at_18%_0%,rgba(234,113,136,0.28),transparent_32%),radial-gradient(circle_at_86%_10%,rgba(255,226,206,0.16),transparent_30%),radial-gradient(circle_at_50%_110%,rgba(122,62,55,0.32),transparent_36%),linear-gradient(135deg,#0B0606_0%,#241412_48%,#070303_100%)] p-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))] text-white backdrop-blur-2xl sm:p-5"
      onClick={handleBackdropClick}
      onWheel={handleWheel}
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(180deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:52px_52px] opacity-[0.08]" />
      <div className="mx-auto flex h-full max-w-[1400px] flex-col gap-3 sm:gap-4" onClick={(event) => event.stopPropagation()} onWheel={handleWheel}>
        <div className="relative z-20 rounded-[1.5rem] border border-white/10 bg-black/30 px-3 py-2 shadow-[0_22px_90px_rgba(0,0,0,0.55)] backdrop-blur-2xl sm:rounded-[1.75rem] sm:px-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-black leading-5 sm:text-base">{alt || "Ảnh xem trước"}</p>
              <div className="mt-1 flex items-center gap-2">
                <span className="rounded-full border border-[#F6A8B8]/25 bg-[#EA7188]/[0.18] px-2.5 py-0.5 text-[11px] font-black text-[#FFD6DF]">
                  {currentIndex + 1}/{list.length}
                </span>
                <span className="hidden text-[11px] font-semibold text-white/[0.55] sm:inline">MÈOO XINHH STUDIO</span>
              </div>
            </div>
            <Button
              variant="secondary"
              size="icon"
              className="relative z-50 !h-12 !w-12 shrink-0 rounded-full border border-white/20 bg-white/95 text-[#2B1C1A] shadow-[0_14px_35px_rgba(0,0,0,0.36)] transition hover:-translate-y-0.5 hover:scale-105 hover:bg-white active:scale-95"
              aria-label="Đóng ảnh"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                onClose();
              }}
            >
              <X size={18} />
            </Button>
          </div>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-[linear-gradient(90deg,#F6A8B8,#EA7188,#FFE0C9)] transition-[width] duration-300 ease-out" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>

        <div
          className="relative flex min-h-0 flex-1 touch-pan-y select-none items-center justify-center overflow-hidden rounded-[1.75rem] border border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,0.08),rgba(255,255,255,0.025))] p-2 shadow-[0_48px_150px_rgba(0,0,0,0.7)] ring-1 ring-white/10 backdrop-blur-xl sm:rounded-[2rem] sm:p-5 md:p-6"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onWheel={handleWheel}
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.11),transparent_56%)]" />
          <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.35] to-transparent" />
          {canSlide ? (
            <>
              <Button className="absolute left-3 top-1/2 z-10 h-12 w-12 -translate-y-1/2 rounded-full border border-white/15 bg-black/40 text-white/85 shadow-[0_18px_60px_rgba(0,0,0,0.5)] backdrop-blur-2xl transition hover:-translate-x-0.5 hover:scale-105 hover:bg-white hover:text-[#2B1C1A] active:scale-95 sm:left-5 sm:h-14 sm:w-14" variant="secondary" size="icon" aria-label="Ảnh trước" onClick={() => move(-1)}>
                <ChevronLeft size={22} />
              </Button>
              <Button className="absolute right-3 top-1/2 z-10 h-12 w-12 -translate-y-1/2 rounded-full border border-white/15 bg-black/40 text-white/85 shadow-[0_18px_60px_rgba(0,0,0,0.5)] backdrop-blur-2xl transition hover:translate-x-0.5 hover:scale-105 hover:bg-white hover:text-[#2B1C1A] active:scale-95 sm:right-5 sm:h-14 sm:w-14" variant="secondary" size="icon" aria-label="Ảnh sau" onClick={() => move(1)}>
                <ChevronRight size={22} />
              </Button>
            </>
          ) : null}
          <div className="relative grid h-full w-full place-items-center overflow-visible px-0 py-1 sm:px-10 sm:py-4 md:px-14" onWheel={handleWheel}>
            <style>{`
              @keyframes image-preview-in {
                from { opacity: 0.48; transform: scale(0.982); filter: blur(1px); }
                to { opacity: 1; transform: scale(1); filter: blur(0); }
              }
              @keyframes image-preview-next {
                from { opacity: 0.42; transform: translate3d(58px,0,0) scale(0.982); filter: blur(1px); }
                to { opacity: 1; transform: translate3d(0,0,0) scale(1); filter: blur(0); }
              }
              @keyframes image-preview-prev {
                from { opacity: 0.42; transform: translate3d(-58px,0,0) scale(0.982); filter: blur(1px); }
                to { opacity: 1; transform: translate3d(0,0,0) scale(1); filter: blur(0); }
              }
            `}</style>
            <div className="grid h-full max-h-full w-full max-w-[min(100%,1080px)] place-items-center overflow-visible sm:max-w-[min(100%,980px)] lg:max-w-[min(100%,1040px)] xl:max-w-[min(100%,1080px)]">
              <img
                key={currentSrc}
                src={currentSrc}
                alt={alt ?? ""}
                draggable={false}
                decoding="async"
                className="block h-full max-h-full w-full max-w-full transform-gpu rounded-[1.25rem] object-contain object-center shadow-[0_26px_85px_rgba(0,0,0,0.58),0_0_0_1px_rgba(255,255,255,0.18)] ring-1 ring-white/15 will-change-transform sm:rounded-[1.75rem]"
                style={{
                  animation: dragging ? undefined : `image-preview-${slideDirection} 420ms cubic-bezier(0.16, 1, 0.3, 1)`,
                  transform: dragging ? `translate3d(${dragOffset}px,0,0) scale(${1 - Math.min(Math.abs(dragOffset) / 3000, 0.025)})` : undefined,
                  transition: dragging ? (settlingDrag ? "transform 180ms cubic-bezier(0.2, 0.8, 0.2, 1)" : "transform 80ms linear") : undefined,
                }}
              />
            </div>
          </div>
        </div>

        {list.length > 1 ? (
          <div className="relative z-20 mx-auto max-w-full rounded-[1.5rem] border border-white/10 bg-black/[0.32] p-2 shadow-[0_24px_80px_rgba(0,0,0,0.58)] backdrop-blur-2xl sm:rounded-[1.75rem] sm:p-3">
            <div className="flex max-w-full snap-x snap-mandatory gap-2 overflow-x-auto overflow-y-hidden overscroll-x-contain scroll-smooth px-0.5 pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] sm:gap-3 [&::-webkit-scrollbar]:hidden">
              {list.map((url, itemIndex) => (
                <button
                  key={`${url}-${itemIndex}`}
                  ref={(element) => {
                    thumbnailRefs.current[itemIndex] = element;
                  }}
                  type="button"
                  onClick={() => selectImage(itemIndex)}
                  className={cn(
                    "grid h-14 w-14 shrink-0 snap-center place-items-center overflow-hidden rounded-[0.95rem] border bg-white/10 p-1 shadow-sm transition hover:-translate-y-0.5 hover:scale-[1.03] sm:h-[4.25rem] sm:w-[4.25rem] sm:rounded-[1.1rem]",
                    itemIndex === currentIndex
                      ? "border-[#F6A8B8] bg-white/95 shadow-[0_0_0_4px_rgba(234,113,136,0.24),0_14px_36px_rgba(234,113,136,0.22)]"
                      : "border-white/[0.12] opacity-70 hover:bg-white/[0.18] hover:opacity-100",
                  )}
                >
                  <img src={url} alt="" draggable={false} className="max-h-full max-w-full rounded-xl object-contain" />
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>,
    document.body
  );
}
