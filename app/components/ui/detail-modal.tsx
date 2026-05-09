"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

interface DetailModalProps {
  /** Close handler */
  onClose: () => void;
  /** Tailwind max-width class, e.g. "max-w-2xl" */
  maxWidth?: string;
  /** Header content (title, avatar, etc.) — placed left of the X button */
  header: ReactNode;
  /** Main body content */
  children: ReactNode;
  /** Optional footer (action buttons) — rendered below body with top margin */
  footer?: ReactNode;
  /** When this key changes, scroll resets to top (e.g. item id) */
  scrollKey?: string;
}

/**
 * Unified detail modal used across the entire studio app.
 *
 * Layout:
 *   ┌─ fixed overlay (backdrop + scroll container) ─────┐
 *   │  ┌─ card ───────────────────────────────────────┐  │
 *   │  │  ┌─ sticky header (content + X) ──────────┐  │  │
 *   │  │  │  {header}                        [X]   │  │  │
 *   │  │  └────────────────────────────────────────┘  │  │
 *   │  │  ┌─ body (scrollable) ────────────────────┐  │  │
 *   │  │  │  {children}                             │  │  │
 *   │  │  │  {footer}                               │  │  │
 *   │  │  │  safe-area-spacer                       │  │  │
 *   │  │  └────────────────────────────────────────┘  │  │
 *   │  └──────────────────────────────────────────────┘  │
 *   └────────────────────────────────────────────────────┘
 */
export function DetailModal({
  onClose,
  maxWidth = "max-w-2xl",
  header,
  children,
  footer,
  scrollKey,
}: DetailModalProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  /* ── body scroll lock ── */
  useEffect(() => {
    const scrollY = window.scrollY;
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    document.body.classList.add("studio-modal-open");
    return () => {
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.width = "";
      document.body.classList.remove("studio-modal-open");
      window.scrollTo(0, scrollY);
    };
  }, []);

  /* ── reset scroll on content change ── */
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [scrollKey]);

  return (
    <div className="fixed inset-0 z-[100] flex flex-col">
      {/* Backdrop — click to close */}
      <div
        className="absolute inset-0 bg-[#2F1E1A]/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Scroll container — fills viewport, scroll happens here */}
      <div
        ref={scrollRef}
        className="relative flex-1 overflow-y-auto overscroll-contain"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        <div className="flex min-h-full items-start justify-center p-3 sm:items-center sm:p-4">
          {/* Card */}
          <div
            className={`relative w-full ${maxWidth} rounded-[2rem] border border-[#F4C7C4] bg-white shadow-[0_24px_80px_rgba(91,52,44,0.28)]`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* ── Sticky Header ── */}
            <div className="sticky top-0 z-30 flex items-start justify-between gap-3 rounded-t-[2rem] border-b border-[#F4C7C4] bg-white/95 px-4 py-3 backdrop-blur sm:px-5">
              <div className="min-w-0 flex-1">{header}</div>
              <button
                type="button"
                className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-[#F4C7C4] bg-white text-[#5B342C] shadow-sm"
                onClick={onClose}
                aria-label="Đóng"
              >
                <X size={18} />
              </button>
            </div>

            {/* ── Body ── */}
            <div className="p-4 sm:p-5">
              {children}

              {footer ? <div className="mt-5">{footer}</div> : null}

              {/* Safe area spacer for mobile nav / home indicator */}
              <div
                className="h-16 sm:hidden"
                style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
