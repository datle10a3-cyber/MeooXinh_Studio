"use client";

import { useEffect, useState } from "react";
import { StudioCatMark } from "@/app/components/brand/studio-brand";

export function AppLoader() {
  const [loading, setLoading] = useState(true);
  const [fade, setFade] = useState(false);

  useEffect(() => {
    // Simulate initial boot or wait for critical resources
    const timer = setTimeout(() => {
      setFade(true);
      setTimeout(() => setLoading(false), 500);
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  if (!loading) return null;

  return (
    <div
      className={`fixed inset-0 z-[2000] flex flex-col items-center justify-center bg-[#FFF3EC] transition-opacity duration-500 ${
        fade ? "opacity-0" : "opacity-100"
      }`}
    >
      <div className="relative mb-8">
        <div className="absolute inset-0 animate-ping rounded-full bg-[#EA7188] opacity-20"></div>
        <div className="relative grid h-24 w-24 place-items-center rounded-[2.5rem] bg-white shadow-[0_15px_45px_rgba(234,113,136,0.15)]">
          <StudioCatMark />
        </div>
      </div>
      
      <div className="flex flex-col items-center gap-2">
        <h1 className="text-xl font-black text-[#5B342C] tracking-tight">MÈOO XINHH STUDIO</h1>
        <div className="flex gap-1.5">
          <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#EA7188]" style={{ animationDelay: "0ms" }}></div>
          <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#EA7188]" style={{ animationDelay: "150ms" }}></div>
          <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#EA7188]" style={{ animationDelay: "300ms" }}></div>
        </div>
      </div>

      <p className="fixed bottom-12 text-xs font-bold text-[#B98278] tracking-widest uppercase">
        Premium Experience
      </p>
    </div>
  );
}
