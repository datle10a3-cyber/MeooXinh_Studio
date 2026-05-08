"use client";

import { useEffect } from "react";

function isChunkLikeError(error: Error) {
  const message = `${error.name || ""} ${error.message || ""} ${error.stack || ""}`;
  return /ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module|Importing a module script failed|module script failed/i.test(message);
}

function recoverFromChunkError() {
  try {
    if (sessionStorage.getItem("studio-error-boundary-chunk-reload")) return false;
    sessionStorage.setItem("studio-error-boundary-chunk-reload", "1");
    hardRecover();
    return true;
  } catch {
    return false;
  }
}

function clearCaches() {
  if (!("caches" in window)) return Promise.resolve();
  return caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key)))).then(() => undefined);
}

function unregisterWorkers() {
  if (!("serviceWorker" in navigator)) return Promise.resolve();
  return navigator.serviceWorker.getRegistrations().then((registrations) => Promise.all(registrations.map((registration) => registration.unregister()))).then(() => undefined);
}

function hardRecover() {
  const reload = () => {
    const target = `${window.location.origin}/?recovered=${Date.now()}`;
    window.location.replace(target);
  };
  unregisterWorkers().then(clearCaches).then(reload).catch(reload);
}

export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    // Tự động recover cho MỌI lỗi một lần duy nhất
    try {
      if (sessionStorage.getItem("studio-error-auto-recovery")) return;
      sessionStorage.setItem("studio-error-auto-recovery", "1");
      hardRecover();
    } catch {}
  }, [error]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#FFF3EC]">
      <div className="text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#EA7188] border-t-transparent mx-auto"></div>
        <p className="mt-4 font-bold text-[#5B342C]">Đang đồng bộ và khởi động lại...</p>
        <p className="mt-1 text-xs text-[#9B746B]">Vui lòng đợi trong giây lát</p>
      </div>
    </div>
  );
}
