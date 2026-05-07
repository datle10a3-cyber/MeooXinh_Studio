"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, Camera, Eye, EyeOff, Heart, Loader2, MailCheck, PawPrint, Sparkles } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { STUDIO_AVATAR_URL, STUDIO_DISPLAY_NAME } from "@/app/components/brand/studio-brand";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ studioName: "", name: "", email: "", password: "", otp: "", inviteCode: "" });
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function sendOtp() {
    setOtpLoading(true);
    setMessage("");
    try {
      const res = await fetch("/api/auth/register/otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email }),
      });
      const result = await res.json().catch(() => null);
      if (!res.ok || result?.error) {
        setMessage(result?.error?.message || "Khong gui duoc OTP. Vui long kiem tra email.");
        return;
      }
      setOtpSent(true);
      setMessage(result?.data?.message || "Da gui OTP den email.");
    } finally {
      setOtpLoading(false);
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const result = await res.json();
    setLoading(false);
    if (result.error) {
      const fieldErrors = result.error.details?.fieldErrors;
      const firstFieldError = fieldErrors ? Object.values(fieldErrors).flat().find(Boolean) : "";
      setMessage(String(firstFieldError || result.error.message || "Dữ liệu đăng ký không hợp lệ."));
      return;
    }
    router.replace("/");
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#FFF3EC] px-4 py-8 text-[#5B342C]">
      <section className="relative mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-6xl items-center gap-8 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="order-2 rounded-[2.5rem] border-4 border-[#F7AFC0] bg-[#FFF9EF] p-5 shadow-[0_24px_80px_rgba(181,91,102,0.2)] lg:order-1">
          <div className="relative overflow-hidden rounded-[2rem] border border-[#F5C1CB] bg-white px-6 py-8 text-center">
            <Sparkles className="absolute left-8 top-8 text-[#F2A8B7]" size={24} />
            <PawPrint className="absolute right-8 top-8 text-[#F2A8B7]" size={28} />
            <div className="mx-auto grid h-20 w-20 place-items-center overflow-hidden rounded-full bg-[#FFE4EA] text-4xl shadow">
              <img src={STUDIO_AVATAR_URL} alt={STUDIO_DISPLAY_NAME} className="h-full w-full rounded-full object-cover" />
            </div>
            <h1 className="mt-4 text-5xl font-black leading-none text-[#EA7188] sm:text-6xl">{STUDIO_DISPLAY_NAME}</h1>
            <p className="mt-3 text-lg font-black text-[#74443A]">make & photo</p>
            <div className="mx-auto mt-5 flex w-fit items-center gap-2 rounded-full border border-[#F7AFC0] bg-[#FFE1E8] px-5 py-2 text-sm font-black">
              <Heart size={16} fill="currentColor" className="text-[#EA7188]" />
              Làm đẹp và lưu giữ thanh xuân
            </div>
            <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-base font-black text-[#EA7188] shadow">
              <Camera size={20} />
              0334043870
            </div>
          </div>
        </div>

        <form onSubmit={submit} className="order-1 rounded-[2rem] border border-[#F4C7C4] bg-white/90 p-6 shadow-[0_20px_60px_rgba(127,69,60,0.16)] backdrop-blur lg:order-2">
          <p className="text-sm font-black uppercase tracking-[0.18em] text-[#E88498]">Khởi tạo studio</p>
          <h2 className="mt-2 text-3xl font-black text-[#5B342C]">Tạo tài khoản quản trị</h2>
          <p className="mt-2 text-sm font-semibold text-[#9B746B]">Chỉ người có mã mời mới tạo được studio mới.</p>

          <div className="mt-7 grid gap-4 md:grid-cols-2">
            <label className="block md:col-span-2">
              <span className="mb-2 block text-sm font-bold text-[#7B554D]">Tên studio</span>
              <Input className="rounded-2xl border-[#F1C5C1] bg-[#FFF9F4] focus:border-[#EA7188] focus:ring-[#FFD4DF]" value={form.studioName} onChange={(event) => setForm({ ...form, studioName: event.target.value })} placeholder="MÈOO XINHH STUDIO make & photo" />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-[#7B554D]">Tên quản trị viên</span>
              <Input className="rounded-2xl border-[#F1C5C1] bg-[#FFF9F4] focus:border-[#EA7188] focus:ring-[#FFD4DF]" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-[#7B554D]">Email</span>
              <Input className="rounded-2xl border-[#F1C5C1] bg-[#FFF9F4] focus:border-[#EA7188] focus:ring-[#FFD4DF]" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
            </label>
            <label className="block md:col-span-2">
              <span className="mb-2 block text-sm font-bold text-[#7B554D]">OTP email</span>
              <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                <Input className="rounded-2xl border-[#F1C5C1] bg-[#FFF9F4] focus:border-[#EA7188] focus:ring-[#FFD4DF]" inputMode="numeric" maxLength={6} value={form.otp} onChange={(event) => setForm({ ...form, otp: event.target.value.replace(/\D/g, "").slice(0, 6) })} placeholder="Nhap 6 so OTP" />
                <Button type="button" variant="secondary" className="h-12 rounded-2xl" disabled={otpLoading || !form.email} onClick={sendOtp}>
                  {otpLoading ? <Loader2 className="animate-spin" size={17} /> : <MailCheck size={17} />}
                  {otpSent ? "Gui lai OTP" : "Gui OTP"}
                </Button>
              </div>
            </label>
            <label className="block md:col-span-2">
              <span className="mb-2 block text-sm font-bold text-[#7B554D]">Mật khẩu</span>
              <span className="relative block">
                <Input className="rounded-2xl border-[#F1C5C1] bg-[#FFF9F4] pr-12 focus:border-[#EA7188] focus:ring-[#FFD4DF]" type={showPassword ? "text" : "password"} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
                <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-3 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-xl text-[#9B746B] hover:bg-[#FFEAF0]">
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </span>
            </label>
            <label className="block md:col-span-2">
              <span className="mb-2 block text-sm font-bold text-[#7B554D]">Mã mời tạo studio</span>
              <Input className="rounded-2xl border-[#F1C5C1] bg-[#FFF9F4] focus:border-[#EA7188] focus:ring-[#FFD4DF]" value={form.inviteCode} onChange={(event) => setForm({ ...form, inviteCode: event.target.value })} placeholder="Nhập mã do quản trị viên cấp" />
            </label>
          </div>

          {message ? <p className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{message}</p> : null}

          <Button className="mt-6 h-12 w-full rounded-2xl bg-[#EA7188] text-white hover:bg-[#DA5E79]" type="submit" disabled={loading}>
            {loading ? <Loader2 className="animate-spin" size={17} /> : <Building2 size={17} />}
            Tạo studio
          </Button>

          <Link href="/login" className="mt-5 block text-center text-sm font-black text-[#EA7188] hover:text-[#C85168]">
            Đã có tài khoản
          </Link>
        </form>
      </section>
    </main>
  );
}
