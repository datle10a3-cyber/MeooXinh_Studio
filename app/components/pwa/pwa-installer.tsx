"use client";

import { useEffect, useState } from "react";
import { Download, X, Share, Monitor } from "lucide-react";
import { StudioCatMark } from "@/app/components/brand/studio-brand";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  prompt(): Promise<void>;
}

function isStandalone() {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
}

function isIosDevice() {
  if (typeof window === "undefined") return false;
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

function isDesktopChrome() {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  return /Chrome/i.test(ua) && !/Mobile/i.test(ua) && !/Android/i.test(ua);
}

export function PwaInstaller() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [platform, setPlatform] = useState<"ios" | "android" | "desktop">("desktop");

  useEffect(() => {
    // Already installed as PWA
    if (isStandalone()) return;

    // Detect platform
    if (isIosDevice()) {
      setPlatform("ios");
      const timer = window.setTimeout(() => {
        const hasSeen = localStorage.getItem("pwa-ios-prompt-seen");
        if (!hasSeen) setShowPrompt(true);
      }, 5000);
      return () => window.clearTimeout(timer);
    }

    const isDesktop = isDesktopChrome();
    setPlatform(isDesktop ? "desktop" : "android");

    // Listen for beforeinstallprompt (Chrome/Edge/Samsung)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);

      const hasDismissed = localStorage.getItem("pwa-prompt-dismissed");
      const dismissedAt = hasDismissed ? Number(hasDismissed) : 0;
      // Show again after 7 days even if dismissed
      const sevenDays = 7 * 24 * 60 * 60 * 1000;
      if (!hasDismissed || Date.now() - dismissedAt > sevenDays) {
        window.setTimeout(() => setShowPrompt(true), 3000);
      }
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // On desktop Chrome, if no beforeinstallprompt fired after 8s,
    // show a manual install hint
    let desktopTimer: number | null = null;
    if (isDesktop) {
      desktopTimer = window.setTimeout(() => {
        const hasDismissed = localStorage.getItem("pwa-prompt-dismissed");
        const dismissedAt = hasDismissed ? Number(hasDismissed) : 0;
        const sevenDays = 7 * 24 * 60 * 60 * 1000;
        if (!hasDismissed || Date.now() - dismissedAt > sevenDays) {
          setShowPrompt(true);
        }
      }, 8000);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      if (desktopTimer) window.clearTimeout(desktopTimer);
    };
  }, []);

  async function handleInstall() {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setShowPrompt(false);
      }
      setDeferredPrompt(null);
    }
  }

  function handleDismiss() {
    setShowPrompt(false);
    if (platform === "ios") {
      localStorage.setItem("pwa-ios-prompt-seen", "true");
    } else {
      localStorage.setItem("pwa-prompt-dismissed", String(Date.now()));
    }
  }

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-24 left-0 right-0 z-50 mx-auto w-[92vw] max-w-sm animate-[slideUp_0.4s_ease-out] sm:bottom-8 sm:left-auto sm:right-6 sm:w-96">
      <div className="relative overflow-hidden rounded-3xl border border-white/40 bg-white/90 p-5 shadow-[0_16px_50px_rgba(91,52,44,0.2)] backdrop-blur-xl">
        <button
          onClick={handleDismiss}
          className="absolute right-3 top-3 rounded-full bg-[#FFF0F4] p-1.5 text-[#9B746B] transition active:scale-95"
          aria-label="Đóng"
        >
          <X size={16} />
        </button>

        <div className="mb-4 flex items-center gap-3">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-tr from-[#FFE1E8] to-[#FFFFFF] shadow-sm">
            <StudioCatMark compact />
          </div>
          <div>
            <h3 className="text-sm font-black text-[#5B342C]">
              {platform === "desktop" ? "Cài App lên Desktop" : "Cài đặt App"}
            </h3>
            <p className="text-xs font-semibold text-[#9B746B]">
              {platform === "desktop"
                ? "Mở nhanh, chạy riêng, không cần mở trình duyệt."
                : "Trải nghiệm mượt mà, không giới hạn."}
            </p>
          </div>
        </div>

        {platform === "ios" ? (
          <div className="rounded-2xl bg-[#FFF8F1] p-3 text-sm font-semibold text-[#5B342C]">
            <p className="mb-2 flex items-center gap-2">
              1. Chạm vào nút <Share size={16} className="text-[#007AFF]" /> ở viền dưới.
            </p>
            <p className="flex items-center gap-2">
              2. Chọn <span className="font-black">Thêm vào MH chính</span> (Add to Home Screen).
            </p>
          </div>
        ) : deferredPrompt ? (
          <button
            onClick={handleInstall}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#EA7188] py-3 text-sm font-black text-white shadow-[0_8px_20px_rgba(234,113,136,0.25)] transition active:scale-95"
          >
            <Download size={18} />
            Cài đặt ngay
          </button>
        ) : (
          <div className="rounded-2xl bg-[#FFF8F1] p-3 text-sm font-semibold text-[#5B342C]">
            <p className="mb-2 flex items-center gap-2">
              <Monitor size={16} className="shrink-0 text-[#EA7188]" />
              Nhấn biểu tượng <span className="font-black">⋮</span> hoặc <span className="font-black">cài đặt</span> trên thanh địa chỉ.
            </p>
            <p className="flex items-center gap-2">
              <Download size={16} className="shrink-0 text-[#EA7188]" />
              Chọn <span className="font-black">&quot;Install Mèoo Xinhh Studio&quot;</span>
            </p>
          </div>
        )}
      </div>

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
