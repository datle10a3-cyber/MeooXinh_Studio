"use client";

import { type RefObject, useEffect, useMemo, useRef, useState } from "react";

export function useProgressiveList<T>(items: T[], batchSize = 60) {
  const [visibleCount, setVisibleCount] = useState(batchSize);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const target = sentinelRef.current;
    if (!target) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setVisibleCount((current) => Math.min(items.length, current + batchSize));
      }
    }, { rootMargin: "700px 0px" });
    observer.observe(target);
    return () => observer.disconnect();
  }, [items.length, batchSize]);

  const visibleItems = useMemo(() => items.slice(0, visibleCount), [items, visibleCount]);

  return {
    visibleItems,
    sentinelRef,
    hasMore: visibleCount < items.length,
    showAll: () => setVisibleCount(items.length),
  };
}

export function ProgressiveListSentinel({
  refTarget,
  hasMore,
  label = "Đang tải thêm...",
}: {
  refTarget: RefObject<HTMLDivElement | null>;
  hasMore: boolean;
  label?: string;
}) {
  return (
    <div ref={refTarget} className="min-h-8 py-3 text-center text-xs font-bold text-[#9B746B]">
      {hasMore ? label : null}
    </div>
  );
}
