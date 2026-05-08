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
    if (isChunkLikeError(error)) recoverFromChunkError();
  }, [error]);

  return (
    <main className="min-h-dvh bg-[#FFF3EC] px-4 py-6 text-[#5B342C]">
      <div className="mx-auto grid min-h-[85dvh] w-full max-w-xl place-items-center">
        <section className="w-full rounded-[2rem] border border-[#F4C7C4] bg-white/90 p-6 text-center shadow-[0_22px_60px_rgba(184,95,108,0.16)]">
          <p className="text-sm font-black uppercase tracking-[0.22em] text-[#EA7188]">Mèoo Xinhh Studio</p>
          <h1 className="mt-3 text-2xl font-black">Ứng dụng cần tải lại</h1>
          <p className="mt-2 text-sm font-semibold text-[#9B746B]">Trình duyệt có thể đang giữ bundle cũ. Hãy thử tải lại để đồng bộ phiên bản mới.</p>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <button className="rounded-full bg-[#EA7188] px-5 py-3 text-sm font-black text-white" onClick={hardRecover} type="button">
              Thử lại
            </button>
            <button className="rounded-full border border-[#F4C7C4] px-5 py-3 text-sm font-black text-[#5B342C]" onClick={hardRecover} type="button">
              Về trang chính
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
