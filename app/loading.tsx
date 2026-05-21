import { StudioCatMark } from "@/app/components/brand/studio-brand";

export default function Loading() {
  return (
    <main className="min-h-dvh bg-[#FFF3EC] px-4 py-6 text-[#5B342C]">
      <div className="mx-auto grid min-h-[85dvh] w-full max-w-6xl place-items-center">
        <div className="w-full max-w-md rounded-[2rem] border border-[#F4C7C4] bg-white/80 p-5 shadow-[0_22px_60px_rgba(184,95,108,0.16)]">
          <div className="flex items-center gap-3">
            <StudioCatMark compact />
            <div>
              <p className="text-sm font-black uppercase tracking-[0.22em] text-[#EA7188]">Mèoo Xinhh Studio</p>
              <p className="mt-1 text-sm font-semibold text-[#9B746B]">Đang mở ứng dụng...</p>
            </div>
          </div>
          <div className="mt-5 space-y-3">
            <div className="h-4 w-2/3 animate-pulse rounded-full bg-[#FFE1E8]" />
            <div className="h-24 animate-pulse rounded-3xl bg-[#FFF0F4]" />
            <div className="grid grid-cols-3 gap-2">
              <div className="h-16 animate-pulse rounded-2xl bg-[#FFF0F4]" />
              <div className="h-16 animate-pulse rounded-2xl bg-[#FFF0F4]" />
              <div className="h-16 animate-pulse rounded-2xl bg-[#FFF0F4]" />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
