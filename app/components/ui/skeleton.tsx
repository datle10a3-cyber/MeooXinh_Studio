"use client";

import { cn } from "@/app/utils/cn";
import { Loader2 } from "lucide-react";

export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-[#F4C7C4]/20", className)}
      {...props}
    />
  );
}

/** Full-page spinner shown while a view is loading */
export function PageSpinner({ label }: { label?: string }) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4">
      <div className="relative flex items-center justify-center">
        {/* outer glow ring */}
        <div className="absolute h-16 w-16 animate-ping rounded-full bg-[#EA7188]/20" />
        {/* spinning icon */}
        <Loader2 className="h-10 w-10 animate-spin text-[#EA7188]" strokeWidth={2.5} />
      </div>
      {label ? (
        <p className="animate-pulse text-sm font-bold text-[#9B746B]">{label}</p>
      ) : (
        <p className="animate-pulse text-sm font-bold text-[#9B746B]">Đang tải dữ liệu…</p>
      )}
    </div>
  );
}

export function ViewSkeleton() {
  return (
    <div className="space-y-5 py-2">
      <PageSpinner />
      <div className="space-y-4">
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
      </div>
    </div>
  );
}
