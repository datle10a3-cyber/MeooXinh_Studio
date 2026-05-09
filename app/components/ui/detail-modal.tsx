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
 * Unified detail modal — renders via Portal directly into <body>
 * to avoid any parent transform/overflow CSS breaking fixed positioning.
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
  useEffect(() => setMounted(true), []);

  // Body scroll lock
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const scrollY = window.scrollY;

    // Lock body scroll
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    body.classList.add("studio-modal-open");

    // Force modal scroll to top after paint
    requestAnimationFrame(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = 0;
    });

    return () => {
      html.style.overflow = "";
      body.style.overflow = "";
      body.classList.remove("studio-modal-open");
      window.scrollTo(0, scrollY);
    };
  }, []);

  // Reset scroll when content changes
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [scrollKey]);

  const modal = (
    <div className="fixed inset-0 z-[100]">
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
