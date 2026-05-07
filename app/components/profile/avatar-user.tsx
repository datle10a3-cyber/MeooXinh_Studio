"use client";

import { cn } from "@/app/utils/cn";
import { STUDIO_AVATAR_URL, STUDIO_DISPLAY_NAME } from "@/app/components/brand/studio-brand";

export function userInitials(name?: string) {
  const parts = (name || STUDIO_DISPLAY_NAME).trim().split(/\s+/).filter(Boolean);
  return parts.slice(-2).map((part) => part[0]?.toUpperCase()).join("") || "SU";
}

export function AvatarUser({
  name,
  avatarUrl,
  size = "md",
  className,
}: {
  name?: string;
  avatarUrl?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizeClass = size === "lg" ? "h-12 w-12 text-base" : size === "sm" ? "h-9 w-9 text-xs" : "h-10 w-10 text-sm";
  return (
    <span className={cn("relative inline-grid shrink-0 place-items-center rounded-full border-2 border-transparent bg-[#EA7188] font-bold text-white transition duration-200 hover:scale-105 hover:border-[#EA7188]", sizeClass, className)}>
      {avatarUrl || STUDIO_AVATAR_URL ? (
        <img src={avatarUrl || STUDIO_AVATAR_URL} alt={name ?? STUDIO_DISPLAY_NAME} className="h-full w-full rounded-full object-cover" />
      ) : (
        userInitials(name)
      )}
      <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-[#FFF3EC]0" />
    </span>
  );
}


