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
 * Structure (single scrollable overlay):
 *   ┌─ fixed overlay (backdrop + scroll) ────────────────┐
 *   │  ┌─ card ───────────────────────────────────────┐  │
 *   │  │  sticky header  [title]              [X]     │  │
 *   │  │  ─────────────────────────────────────────── │  │
 *   │  │  body content                                │  │
 *   │  │  footer (action buttons)                     │  │
 *   │  │  bottom spacer                               │  │
 *   │  └──────────────────────────────────────────────┘  │
 *   └────────────────────────────────────────────────────┘
 *
 * Key design decisions:
 * - ONE div is backdrop + scroll container (no separate layers)
 * - Body scroll lock uses overflow:hidden only (no position:fixed on body)
 * - overscroll-contain prevents scroll chaining on mobile
 * - Large bottom spacer (h-28) to clear mobile nav bars
 * - Sticky header for X button always accessible
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
    const html = document.documentElement;
    // Prevent body scroll — simple overflow:hidden on <html>
    // No position:fixed trick (causes scroll-to-top and conflicts with modal)
    html.style.overflow = "hidden";
    document.body.classList.add("studio-modal-open");
    return () => {
      html.style.overflow = "";
      document.body.classList.remove("studio-modal-open");
    };
  }, []);

  /* ── reset scroll on content change ── */
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [scrollKey]);

  return (
    <div
      ref={scrollRef}
      className="fixed inset-0 z-[100] overflow-y-auto overscroll-contain bg-[#2F1E1A]/60 backdrop-blur-sm"
      style={{ WebkitOverflowScrolling: "touch" }}
      onClick={onClose}
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

            {/* Bottom spacer — large enough to clear mobile nav bars + home indicator */}
            <div
              className="h-28 sm:h-6"
              style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
