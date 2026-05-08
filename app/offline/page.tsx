"use client";

export default function OfflinePage() {
  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center p-6 text-center">
      <div className="mb-6 grid h-24 w-24 place-items-center rounded-3xl bg-[#FFF0F4] shadow-inner">
        <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#EA7188" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="1" y1="1" x2="23" y2="23"></line>
          <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"></path>
          <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"></path>
          <path d="M10.71 5.05A16 16 0 0 1 22.58 9"></path>
          <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"></path>
          <path d="M8.53 16.11a6 6 0 0 1 6.95 0"></path>
          <line x1="12" y1="20" x2="12.01" y2="20"></line>
        </svg>
      </div>
      <h1 className="mb-2 text-2xl font-black text-[#5B342C]">Không có kết nối mạng</h1>
      <p className="mb-8 max-w-[280px] text-sm font-semibold leading-relaxed text-[#9B746B]">
        Vui lòng kiểm tra lại kết nối Wifi hoặc 4G/5G của bạn để tiếp tục sử dụng ứng dụng.
      </p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="rounded-2xl bg-[#EA7188] px-8 py-3.5 text-sm font-black text-white shadow-[0_12px_24px_rgba(234,113,136,0.25)] transition active:scale-95"
      >
        Thử lại ngay
      </button>
    </div>
  );
}
