"use client";

import { useEffect, useRef, useState } from "react";

function isStandalonePwa() {
  if (typeof window === "undefined") return false;
  const navigatorWithStandalone = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || navigatorWithStandalone.standalone === true;
}

export function IosLaunchSplash() {
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const visibleRef = useRef(false);

  useEffect(() => {
    if (!isStandalonePwa()) return;
    if (window.sessionStorage.getItem("mx-ios-splash-shown") === "1") return;

    window.sessionStorage.setItem("mx-ios-splash-shown", "1");
    visibleRef.current = true;
    const showFrame = window.requestAnimationFrame(() => setVisible(true));

    function dismiss() {
      if (!visibleRef.current) return;
      visibleRef.current = false;
      setLeaving(true);
      window.setTimeout(() => setVisible(false), 240);
    }

    const holdTimer = window.setTimeout(() => setLeaving(true), 1400);
    const removeTimer = window.setTimeout(dismiss, 1900);
    const hardRemoveTimer = window.setTimeout(() => setVisible(false), 2600);
    const pageShowTimer = window.setTimeout(() => {
      if (document.visibilityState === "visible") dismiss();
    }, 2200);

    window.addEventListener("pageshow", dismiss);
    window.addEventListener("focus", dismiss);
    document.addEventListener("visibilitychange", dismiss);
    document.addEventListener("touchstart", dismiss, { passive: true });
    document.addEventListener("pointerdown", dismiss);
    return () => {
      window.clearTimeout(holdTimer);
      window.clearTimeout(removeTimer);
      window.clearTimeout(hardRemoveTimer);
      window.clearTimeout(pageShowTimer);
      window.cancelAnimationFrame(showFrame);
      window.removeEventListener("pageshow", dismiss);
      window.removeEventListener("focus", dismiss);
      document.removeEventListener("visibilitychange", dismiss);
      document.removeEventListener("touchstart", dismiss);
      document.removeEventListener("pointerdown", dismiss);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      className={[
        "pointer-events-none fixed inset-0 z-[9999] grid place-items-center bg-[#F5A3C7] px-8 transition-opacity duration-300 ease-out",
        leaving ? "opacity-0" : "opacity-100",
      ].join(" ")}
      style={{ animation: "mxSplashFailsafe 2.6s ease forwards" }}
      aria-hidden="true"
    >
      <div className="flex min-h-[9rem] w-full max-w-[20rem] items-center justify-center gap-4 rounded-[2rem] border border-white/60 bg-white/92 px-7 py-6 shadow-[0_24px_70px_rgba(107,52,72,0.24)]">
        <div className="relative h-16 w-16 shrink-0">
          <span className="absolute left-2 top-1 h-5 w-5 -rotate-12 rounded-[0.45rem] border-2 border-[#E77EAA] bg-[#FFD7E8]" />
          <span className="absolute right-2 top-1 h-5 w-5 rotate-12 rounded-[0.45rem] border-2 border-[#E77EAA] bg-[#FFD7E8]" />
          <span className="absolute inset-x-1 bottom-0 top-3 rounded-full border-4 border-[#F5A3C7]/65 bg-[#FFE8F1] shadow-inner" />
          <span className="absolute left-[1.35rem] top-8 h-1.5 w-1.5 rounded-full bg-[#6B3448]" />
          <span className="absolute right-[1.35rem] top-8 h-1.5 w-1.5 rounded-full bg-[#6B3448]" />
          <span className="absolute left-1/2 top-[2.55rem] h-2 w-2 -translate-x-1/2 rounded-full bg-[#EA7188]" />
          <span className="absolute left-[1.15rem] top-[2.6rem] h-px w-3 -rotate-12 bg-[#C85C86]" />
          <span className="absolute right-[1.15rem] top-[2.6rem] h-px w-3 rotate-12 bg-[#C85C86]" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-black uppercase tracking-[0.22em] text-[#C85C86]">MÈOO XINHH</p>
          <p className="mt-1 text-3xl font-black leading-none text-[#6B3448]">STUDIO</p>
          <p className="mt-3 text-sm font-bold text-[#8B5D6E]">make & photo</p>
        </div>
      </div>
      <style jsx>{`
        @keyframes mxSplashFailsafe {
          0%,
          72% {
            opacity: 1;
            visibility: visible;
          }
          100% {
            opacity: 0;
            visibility: hidden;
          }
        }
      `}</style>
    </div>
  );
}
