"use client";

import { useState } from "react";
import Link from "next/link";
import { Camera, Eye, EyeOff, Heart, Loader2, LogIn, PawPrint, Sparkles } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { STUDIO_AVATAR_URL, STUDIO_DISPLAY_NAME } from "@/app/components/brand/studio-brand";
import { AlertModal } from "@/app/components/ui/alert-modal";

export default function LoginPage() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const result = await res.json().catch(() => null);
      if (!res.ok || result?.error) {
        setMessage(result?.error?.message || "Không đăng nhập được. Vui lòng kiểm tra email và mật khẩu.");
        return;
      }
      window.location.assign("/");
    } catch {
      setMessage("Không kết nối được máy chủ đăng nhập. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#FFF3EC] px-4 py-8 text-[#5B342C]">
      <div className="pointer-events-none fixed inset-0 opacity-70">
        <div className="absolute left-8 top-10 h-28 w-28 rounded-full bg-[#FFD4DF] blur-3xl" />
        <div className="absolute bottom-16 right-12 h-40 w-40 rounded-full bg-[#F8C3B8] blur-3xl" />
      </div>

      <section className="relative mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-6xl items-center gap-8 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-[2.5rem] border-4 border-[#F7AFC0] bg-[#FFF9EF] p-6 shadow-[0_24px_80px_rgba(181,91,102,0.22)]">
          <div className="relative overflow-hidden rounded-[2rem] border border-[#F5C1CB] bg-white px-6 py-10 text-center shadow-inner">
            <div className="absolute left-8 top-8 text-[#F2A8B7]"><Sparkles size={26} /></div>
            <div className="absolute right-8 top-10 text-[#F2A8B7]"><PawPrint size={30} /></div>
            <div className="absolute bottom-8 left-10 text-[#D98C81]"><Heart size={24} fill="currentColor" /></div>
            <div className="mx-auto mb-4 grid h-24 w-24 place-items-center rounded-full border-4 border-white bg-[#FFE4EA] text-[#E86F87] shadow-lg">
              <img src={STUDIO_AVATAR_URL} alt={STUDIO_DISPLAY_NAME} className="h-full w-full rounded-full object-cover" />
            </div>
            <h1 className="text-6xl font-black leading-none tracking-tight text-[#EA7188] drop-shadow-sm sm:text-7xl">
              {STUDIO_DISPLAY_NAME}
            </h1>
            <div className="mt-4 flex items-center justify-center gap-3 text-lg font-black tracking-wide text-[#74443A]">
              <span className="h-px w-16 bg-[#E6B0A5]" />
              make & photo
              <span className="h-px w-16 bg-[#E6B0A5]" />
            </div>
            <div className="mx-auto mt-6 w-fit rounded-full border border-[#F7AFC0] bg-[#FFE1E8] px-6 py-2 text-sm font-black text-[#5B342C] shadow-sm">
              Làm đẹp và lưu giữ thanh xuân
            </div>
            <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-lg font-black text-[#EA7188] shadow">
              <Camera size={22} />
              0334043870
            </div>
          </div>
        </div>

        <form onSubmit={submit} className="rounded-[2rem] border border-[#F4C7C4] bg-white/90 p-6 shadow-[0_20px_60px_rgba(127,69,60,0.16)] backdrop-blur">
          <p className="text-sm font-black uppercase tracking-[0.18em] text-[#E88498]">Studio Manager</p>
          <h2 className="mt-2 text-3xl font-black text-[#5B342C]">Đăng nhập</h2>
          <p className="mt-2 text-sm font-semibold text-[#9B746B]">Vào hệ thống quản lý booking, dự án và tài chính của {STUDIO_DISPLAY_NAME}.</p>

          <div className="mt-7 space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-[#7B554D]">Email</span>
              <Input className="rounded-2xl border-[#F1C5C1] bg-[#FFF9F4] focus:border-[#EA7188] focus:ring-[#FFD4DF]" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-[#7B554D]">Mật khẩu</span>
              <span className="relative block">
                <Input className="rounded-2xl border-[#F1C5C1] bg-[#FFF9F4] pr-12 focus:border-[#EA7188] focus:ring-[#FFD4DF]" type={showPassword ? "text" : "password"} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
                <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-3 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-xl text-[#9B746B] hover:bg-[#FFEAF0]">
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </span>
            </label>
          </div>

          <AlertModal isOpen={!!message} message={message} onClose={() => setMessage("")} />

          <Button className="mt-6 h-12 w-full rounded-2xl bg-[#EA7188] text-white hover:bg-[#DA5E79]" type="submit" disabled={loading}>
            {loading ? <Loader2 className="animate-spin" size={17} /> : <LogIn size={17} />}
            Đăng nhập
          </Button>

          <Link href="/forgot-password" className="mt-3 block text-center text-sm font-black text-[#A84E61] transition hover:text-[#EA7188]">
            Quên mật khẩu?
          </Link>

          <Link href="/register" className="mt-5 block rounded-2xl border border-[#F4C7C4] bg-white px-4 py-3 text-center text-sm font-black text-[#EA7188] shadow-sm transition hover:bg-[#FFF3EC]">
            Tạo studio mới bằng mã mời
          </Link>
        </form>
      </section>
    </main>
  );
}
