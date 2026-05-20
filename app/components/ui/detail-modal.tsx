"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

interface DetailModalProps {
  onClose: () => void;
  maxWidth?: string;
  header: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  scrollKey?: string;
}

/**
 * Returns true when we're on a tablet/iPad (pointer: coarse + wide screen).
 * On tablet, skip body scroll lock to avoid layout jank on iPad Safari.
 */
function isTabletOrDesktop() {
  if (typeof window === "undefined") return false;
  return window.innerWidth >= 768;
}

/**
 * Unified detail modal — renders via Portal directly into <body>
 * to avoid any parent transform/overflow CSS breaking fixed positioning.
 *
 * Scroll lock strategy:
 * - Mobile (<768px): position:fixed body + restore scrollY on close (standard iOS modal lock)
 * - Tablet/Desktop (>=768px): NO body position:fixed — modal is self-contained,
 *   body lock is not needed and causes jank when closing on iPad Safari.
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
  const [mounted, setMounted] = useState(false);

  // Portal mount
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
    const modalId = Math.random().toString(36).substring(2, 9);
    const stateKey = `modal-${modalId}`;
    
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

  // Body scroll lock — ONLY on mobile (<768px).
  // Tablet/Desktop: skip entirely. position:fixed on body causes layout recalc
  // when the modal closes, creating the "jank + hold finger" bug on iPad Safari.
  useEffect(() => {
    const body = document.body;
    const tablet = isTabletOrDesktop();

    // Force modal scroll to top after paint
    requestAnimationFrame(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = 0;
    });

    if (tablet) {
      // Tablet/Desktop: just mark the class for stacking, no position:fixed
      const isAlreadyLocked = body.classList.contains("studio-modal-open");
      if (!isAlreadyLocked) body.classList.add("studio-modal-open");
      return () => {
        setTimeout(() => {
          if (!document.querySelector(".studio-modal-open-element")) {
            body.classList.remove("studio-modal-open");
          }
        }, 0);
      };
    }

    // Mobile: full scroll lock with position:fixed
    const isAlreadyLocked = body.classList.contains("studio-modal-open");
    let scrollY = 0;
    if (!isAlreadyLocked) {
      scrollY = window.scrollY;
      body.style.position = "fixed";
      body.style.top = `-${scrollY}px`;
      body.style.left = "0";
      body.style.right = "0";
      body.style.width = "100%";
      body.classList.add("studio-modal-open");
    }

    return () => {
      setTimeout(() => {
        if (!document.querySelector(".studio-modal-open-element")) {
          body.style.position = "";
          body.style.top = "";
          body.style.left = "";
          body.style.right = "";
          body.style.width = "";
          body.classList.remove("studio-modal-open");
          if (!isAlreadyLocked) {
            // Restore scroll position — mobile only, no layout jank since body is not scrollable on tablet
            window.scrollTo(0, scrollY);
          }
        }
      }, 0);
    };
  }, []);

  // Reset scroll when content changes
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [scrollKey]);

  const modal = (
    <div className="studio-modal-open-element fixed inset-0 z-[320]">
      {/* Scroll container — absolute fills the fixed shell */}
      <div
        ref={scrollRef}
        className="absolute inset-0 overflow-y-auto bg-[#2F1E1A]/60 backdrop-blur-sm"
        style={{ WebkitOverflowScrolling: "touch", overscrollBehavior: "none" }}
        onClick={onClose}
      >
        <div className="flex min-h-full items-start justify-center p-3 sm:items-center sm:p-4">
          {/* Card */}
          <div
            className={`relative w-full ${maxWidth} rounded-[2rem] border border-[#F4C7C4] bg-white shadow-[0_24px_80px_rgba(91,52,44,0.28)]`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Sticky Header */}
            <div className="sticky top-0 z-30 flex items-start justify-between gap-3 rounded-t-[2rem] border-b border-[#F4C7C4] bg-white/95 px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] backdrop-blur sm:px-5 sm:pt-3">
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

            {/* Body */}
            <div className="p-4 sm:p-5">
              {children}
              {footer ? <div className="mt-5">{footer}</div> : null}
              <div
                className="h-28 sm:h-6"
                style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  if (!mounted) return null;
  return createPortal(modal, document.body);
}
