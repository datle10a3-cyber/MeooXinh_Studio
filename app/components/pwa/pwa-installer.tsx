"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

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

function isInAppBrowser() {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  // Messenger, Facebook, Instagram, Zalo, Line etc. in-app browsers
  return /FBAN|FBAV|Instagram|Zalo|Line|Messenger/i.test(ua);
}

function isIosDevice() {
  if (typeof window === "undefined") return false;
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

export function PwaInstaller() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;

    // Don't show in-app browser install prompts — they can't install PWAs
    if (isInAppBrowser()) return;

    const iosDevice = isIosDevice();
    setIsIOS(iosDevice);

    if (iosDevice) {
      // On iOS Safari: show a simple hint after 6s, once only
      const timer = window.setTimeout(() => {
        const hasSeen = localStorage.getItem("pwa-ios-seen");
        if (!hasSeen) setShowPrompt(true);
      }, 6000);
      return () => window.clearTimeout(timer);
    }

    // Android / Desktop: listen for beforeinstallprompt
    const handlePrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      const dismissed = localStorage.getItem("pwa-dismissed");
      const sevenDays = 7 * 24 * 60 * 60 * 1000;
      if (!dismissed || Date.now() - Number(dismissed) > sevenDays) {
        window.setTimeout(() => setShowPrompt(true), 3000);
      }
    };

    window.addEventListener("beforeinstallprompt", handlePrompt);
    return () => window.removeEventListener("beforeinstallprompt", handlePrompt);
  }, []);

  async function handleInstall() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setShowPrompt(false);
    setDeferredPrompt(null);
  }

  function dismiss() {
    setShowPrompt(false);
    localStorage.setItem(isIOS ? "pwa-ios-seen" : "pwa-dismissed", String(Date.now()));
  }

  if (!showPrompt) return null;

  return (
    <>
      {/* Compact banner — sits above bottom nav on mobile, bottom-right on desktop */}
      <div className="fixed bottom-[5.5rem] left-3 right-3 z-50 mx-auto max-w-sm animate-[pwaSlide_0.35s_ease-out] sm:bottom-6 sm:left-auto sm:right-6">
        <div className="flex items-center gap-3 rounded-2xl border border-[#F4C7C4] bg-white px-4 py-3 shadow-[0_12px_40px_rgba(91,52,44,0.16)]">
          {/* Icon */}
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#FFF0F4] text-lg">
            🐱
          </div>

          {/* Text */}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black text-[#5B342C]">
              {isIOS ? "Thêm vào màn hình chính" : "Cài đặt ứng dụng"}
            </p>
            <p className="mt-0.5 text-xs font-semibold text-[#9B746B]">
              {isIOS
                ? "Bấm chia sẻ ⬆ rồi chọn \"Thêm vào MH chính\""
                : "Trải nghiệm mượt như app thật"}
            </p>
          </div>

          {/* Action */}
          {!isIOS && deferredPrompt ? (
            <button
              onClick={handleInstall}
              className="shrink-0 rounded-xl bg-[#EA7188] px-3 py-2 text-xs font-black text-white shadow-sm transition active:scale-95"
            >
              <Download size={14} className="mr-1 inline" />
              Cài
            </button>
          ) : null}

          {/* Close */}
          <button
            onClick={dismiss}
            className="shrink-0 rounded-full p-1.5 text-[#9B746B] transition hover:bg-[#FFF0F4] active:scale-95"
            aria-label="Đóng"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      <style>{`
        @keyframes pwaSlide {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  );
}
