"use client";

import { type RefObject, useEffect, useMemo, useRef, useState, startTransition } from "react";

/**
 * Progressive list hook – renders items in batches using IntersectionObserver.
 *
 * Key performance decisions:
 * - `initialBatch` is kept small (capped at 12) so the first paint is fast on iPad.
 * - Subsequent batches use `startTransition` so they don't block user interaction.
 * - `rootMargin` is generous (600px) so the next batch loads before the user scrolls to it.
 * - When the source `items` array changes (e.g. after a filter), we reset to `initialBatch`
 *   to avoid rendering a stale large list that causes jank.
 */
export function useProgressiveList<T>(items: T[], batchSize = 60) {
  // Cap the very first render to a small number so mounting is fast
  const initialBatch = Math.min(batchSize, 12);
  const [visibleCount, setVisibleCount] = useState(initialBatch);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const prevLengthRef = useRef(items.length);

  // When the items array length changes (filter/search/new data), reset visible count
  // so we don't try to render hundreds of items at once on iPad
  useEffect(() => {
    if (items.length !== prevLengthRef.current) {
      prevLengthRef.current = items.length;
      setVisibleCount(initialBatch);
    }
  }, [items.length, initialBatch]);

  useEffect(() => {
    const target = sentinelRef.current;
    if (!target) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        // Use startTransition so the browser can keep responding to taps/scrolls
        startTransition(() => {
          setVisibleCount((current) => Math.min(items.length, current + batchSize));
        });
      }
    }, { rootMargin: "600px 0px" });
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
