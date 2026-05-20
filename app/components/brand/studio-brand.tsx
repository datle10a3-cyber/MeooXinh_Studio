"use client";

import type { ReactNode } from "react";
import { PawPrint } from "lucide-react";

export const STUDIO_DISPLAY_NAME = "MÈOO XINHH";
export const STUDIO_AVATAR_URL = "/be-meo-studio-avatar.svg";

export function StudioCatMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? "studio-brand-mark flex items-center gap-2" : "studio-brand-mark flex items-center gap-3"}>
      <div
        className={
          compact
            ? "grid h-10 w-10 place-items-center overflow-hidden rounded-full bg-[#FFE4EA] text-[#EA7188]"
            : "grid h-12 w-12 place-items-center overflow-hidden rounded-full bg-[#FFE4EA] text-[#EA7188]"
        }
      >
        <img src={STUDIO_AVATAR_URL} alt={STUDIO_DISPLAY_NAME} className="h-full w-full rounded-full object-cover" />
      </div>
      <div className="min-w-0">
        <p className="whitespace-normal break-words text-xs font-black uppercase tracking-[0.18em] text-[#E88498]">Studio</p>
        <h1 className={compact ? "whitespace-normal break-words text-xl font-black leading-6 text-[#EA7188]" : "whitespace-normal break-words text-2xl font-black leading-7 text-[#EA7188]"}>
          {STUDIO_DISPLAY_NAME}
        </h1>
      </div>
      {!compact ? <PawPrint className="shrink-0 text-[#EA7188]" size={22} /> : null}
    </div>
  );
}

export function StudioBrandPanel({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title?: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <section className="studio-stable-decor rounded-[1.65rem] border border-[#F7AFC0] bg-[#FFF8F1] p-4 shadow-[0_18px_50px_rgba(184,95,108,0.12)] sm:rounded-[2rem] sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 space-y-3">
          <div className="inline-flex max-w-full rounded-[1.7rem] border-4 border-[#F7AFC0] bg-white px-4 py-3 shadow-sm sm:px-6">
            <StudioCatMark />
          </div>
          {eyebrow ? <p className="text-xs font-black uppercase tracking-[0.18em] text-[#E88498]">{eyebrow}</p> : null}
          {title ? <h1 className="whitespace-normal break-words text-2xl font-black leading-8 text-[#5B342C] sm:text-3xl">{title}</h1> : null}
          {description ? <p className="max-w-3xl whitespace-normal break-words text-sm font-semibold leading-6 text-[#9B746B]">{description}</p> : null}
        </div>
        {actions ? <div className="grid gap-2 sm:flex sm:flex-wrap sm:justify-end">{actions}</div> : null}
      </div>
    </section>
  );
}
