"use client";

import { useEffect, useState } from "react";
import { Download, X, Share } from "lucide-react";
import { StudioCatMark } from "@/app/components/brand/studio-brand";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  prompt(): Promise<void>;
}

export function PwaInstaller() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Check if app is already installed
    if (window.matchMedia("(display-mode: standalone)").matches) return;

    // Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIosDevice);

    if (isIosDevice) {
      // For iOS, we can't intercept beforeinstallprompt, just show a hint after a delay
      const timer = window.setTimeout(() => {
        const hasSeenPrompt = localStorage.getItem("pwa-ios-prompt-seen");
        if (!hasSeenPrompt) setShowPrompt(true);
      }, 5000);
      return () => window.clearTimeout(timer);
    }

    // For Android/Desktop
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      
      const hasDismissed = localStorage.getItem("pwa-prompt-dismissed");
      if (!hasDismissed) {
        setTimeout(() => setShowPrompt(true), 3000);
      }
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
  }, []);

  async function handleInstall() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setShowPrompt(false);
    }
    setDeferredPrompt(null);
  }

  function handleDismiss() {
    setShowPrompt(false);
    localStorage.setItem(isIOS ? "pwa-ios-prompt-seen" : "pwa-prompt-dismissed", "true");
  }

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-24 left-0 right-0 z-50 mx-auto w-[92vw] max-w-sm sm:bottom-8">
      <div className="relative overflow-hidden rounded-3xl border border-white/40 bg-white/80 p-5 shadow-[0_12px_45px_rgba(91,52,44,0.18)] backdrop-blur-xl">
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
            <h3 className="text-sm font-black text-[#5B342C]">Cài đặt App</h3>
            <p className="text-xs font-semibold text-[#9B746B]">Trải nghiệm mượt mà, không giới hạn.</p>
          </div>
        </div>

        {isIOS ? (
          <div className="rounded-2xl bg-[#FFF8F1] p-3 text-sm font-semibold text-[#5B342C]">
            <p className="mb-2 flex items-center gap-2">
              1. Chạm vào nút <Share size={16} className="text-[#007AFF]" /> ở viền dưới.
            </p>
            <p className="flex items-center gap-2">
              2. Chọn <span className="font-black">Thêm vào MH chính</span> (Add to Home Screen).
            </p>
          </div>
        ) : (
          <button
            onClick={handleInstall}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#EA7188] py-3 text-sm font-black text-white shadow-[0_8px_20px_rgba(234,113,136,0.25)] transition active:scale-95"
          >
            <Download size={18} />
            Cài đặt ngay
          </button>
        )}
      </div>
    </div>
  );
}
