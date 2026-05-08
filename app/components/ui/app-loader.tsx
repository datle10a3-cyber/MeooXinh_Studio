"use client";

import { useEffect, useState } from "react";
import { STUDIO_AVATAR_URL } from "@/app/components/brand/studio-brand";

export function AppLoader() {
  const [phase, setPhase] = useState<"boot" | "ready" | "exit" | "done">("boot");

  useEffect(() => {
    // boot → ready (logo animates in)
    const t1 = requestAnimationFrame(() => {
      requestAnimationFrame(() => setPhase("ready"));
    });

    // ready → exit (fade out after content likely loaded)
    const t2 = window.setTimeout(() => setPhase("exit"), 1800);

    // exit → done (remove from DOM after transition)
    const t3 = window.setTimeout(() => setPhase("done"), 2400);

    return () => {
      cancelAnimationFrame(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, []);

  if (phase === "done") return null;

  const isVisible = phase === "ready";
  const isExit = phase === "exit";

  return (
    <div
      aria-hidden
      className="fixed inset-0 z-[2000] will-change-[opacity]"
      style={{
        opacity: isExit ? 0 : 1,
        transition: "opacity 600ms cubic-bezier(0.22, 1, 0.36, 1)",
        pointerEvents: isExit ? "none" : "auto",
      }}
    >
      {/* Background with subtle gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#FFF3EC] via-[#FFF7F2] to-[#FFEEE4]" />

      {/* Content wrapper — absolute center */}
      <div
        className="relative flex h-full w-full flex-col items-center justify-center"
        style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {/* Main content group */}
        <div
          className="flex flex-col items-center will-change-transform"
          style={{
            opacity: isVisible || isExit ? 1 : 0,
            transform: isVisible || isExit ? "translateY(0) scale(1)" : "translateY(16px) scale(0.92)",
            transition: "opacity 700ms cubic-bezier(0.22, 1, 0.36, 1), transform 700ms cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        >
          {/* Logo with glow */}
          <div className="relative mb-5">
            {/* Glow behind logo */}
            <div
              className="absolute inset-[-40px] rounded-full blur-[40px]"
              style={{
                background: "radial-gradient(circle, rgba(234,113,136,0.25) 0%, rgba(234,113,136,0.08) 50%, transparent 80%)",
                opacity: isVisible || isExit ? 1 : 0,
                transition: "opacity 1.2s ease-out 0.2s",
              }}
            />

            {/* Pulse ring */}
            <div
              className="absolute inset-[-8px] rounded-[2.2rem]"
              style={{
                border: "2px solid rgba(234,113,136,0.18)",
                opacity: isVisible || isExit ? 1 : 0,
                animation: isVisible ? "loaderPulse 2.5s cubic-bezier(0.4, 0, 0.6, 1) infinite" : "none",
                transition: "opacity 0.6s ease-out 0.4s",
              }}
            />

            {/* Logo container */}
            <div className="relative grid h-24 w-24 place-items-center overflow-hidden rounded-[2rem] bg-white shadow-[0_12px_40px_rgba(234,113,136,0.15),0_4px_12px_rgba(91,52,44,0.06)] sm:h-28 sm:w-28 sm:rounded-[2.2rem]">
              <img
                src={STUDIO_AVATAR_URL}
                alt="Mèoo Xinhh"
                className="h-[75%] w-[75%] rounded-full object-cover"
                draggable={false}
              />
            </div>
          </div>

          {/* Text */}
          <h1
            className="mb-3 text-center text-xl font-black tracking-tight text-[#5B342C] sm:text-2xl"
            style={{
              opacity: isVisible || isExit ? 1 : 0,
              transform: isVisible || isExit ? "translateY(0)" : "translateY(10px)",
              transition: "opacity 600ms ease-out 250ms, transform 600ms ease-out 250ms",
            }}
          >
            MÈOO XINHH STUDIO
          </h1>

          {/* Loading dots */}
          <div
            className="flex items-center gap-[6px]"
            style={{
              opacity: isVisible || isExit ? 1 : 0,
              transition: "opacity 500ms ease-out 400ms",
            }}
          >
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-[6px] w-[6px] rounded-full bg-[#EA7188]"
                style={{
                  animation: isVisible ? `loaderDot 1.4s cubic-bezier(0.4, 0, 0.6, 1) ${i * 200}ms infinite` : "none",
                }}
              />
            ))}
          </div>
        </div>

        {/* Footer tagline */}
        <p
          className="absolute bottom-10 w-full px-6 text-center text-[10px] font-bold uppercase tracking-[0.3em] text-[#C9A096]/60 sm:bottom-12"
          style={{
            opacity: isVisible || isExit ? 1 : 0,
            transition: "opacity 800ms ease-out 600ms",
          }}
        >
          Premium Studio Management
        </p>
      </div>

      {/* Keyframes */}
      <style>{`
        @keyframes loaderPulse {
          0%, 100% { transform: scale(1); opacity: 0.5; border-width: 2px; }
          50% { transform: scale(1.15); opacity: 0.1; border-width: 1px; }
        }
        @keyframes loaderDot {
          0%, 80%, 100% { transform: scale(0.7); opacity: 0.35; }
          40% { transform: scale(1.1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
