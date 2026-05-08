"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log lỗi để debug nếu cần
    console.error("App Error Boundary:", error);
  }, [error]);

  const isChunkError = /ChunkLoadError|Loading chunk|module script failed/i.test(error.message || "");

  return (
    <main className="min-h-dvh bg-[#FFF3EC] px-4 py-6 text-[#5B342C]">
      <div className="mx-auto grid min-h-[85dvh] w-full max-w-xl place-items-center">
        <section className="w-full rounded-[2rem] border border-[#F4C7C4] bg-white/90 p-6 text-center shadow-[0_22px_60px_rgba(184,95,108,0.16)]">
          <p className="text-sm font-black uppercase tracking-[0.22em] text-[#EA7188]">Mèoo Xinhh Studio</p>
          <h1 className="mt-3 text-2xl font-black">
            {isChunkError ? "Ứng dụng cần cập nhật" : "Đã có lỗi xảy ra"}
          </h1>
          <p className="mt-2 text-sm font-semibold text-[#9B746B]">
            {isChunkError 
              ? "Trình duyệt đang giữ phiên bản cũ. Hãy thử tải lại để đồng bộ." 
              : "Ứng dụng gặp sự cố tạm thời. Hãy thử làm mới trang."}
          </p>
          
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <button 
              className="rounded-full bg-[#EA7188] px-6 py-3 text-sm font-black text-white shadow-lg active:scale-95 transition-transform"
              onClick={() => {
                if (isChunkError) {
                  window.location.reload();
                } else {
                  reset();
                }
              }}
            >
              Thử lại ngay
            </button>
            <button 
              className="rounded-full border border-[#F4C7C4] px-6 py-3 text-sm font-black text-[#5B342C] active:scale-95 transition-transform"
              onClick={() => window.location.href = "/"}
            >
              Về trang chính
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
