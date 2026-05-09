"use client";

import Link from "next/link";
import { useState } from "react";
import { Eye, EyeOff, KeyRound, Loader2, Send } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { AlertModal } from "@/app/components/ui/alert-modal";

export default function ForgotPasswordPage() {
  const [form, setForm] = useState({ email: "", otp: "", password: "", confirmPassword: "" });
  const [message, setMessage] = useState("");
  const [successTone, setSuccessTone] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  async function sendOtp() {
    setSendingOtp(true);
    setMessage("");
    setSuccessTone(false);
    const result = await fetch("/api/auth/password-reset/otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: form.email }),
    }).then((res) => res.json()).catch(() => null);
    setSendingOtp(false);
    if (result?.error) {
      setMessage(result.error.message);
      return;
    }
    setSuccessTone(true);
    setMessage("Nếu email tồn tại, mã OTP đã được gửi. Kiểm tra hộp thư rồi nhập mã bên dưới.");
  }

  async function resetPassword(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setSuccessTone(false);
    const result = await fetch("/api/auth/password-reset", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    }).then((res) => res.json()).catch(() => null);
    setSaving(false);
    if (result?.error) {
      setMessage(result.error.message);
      return;
    }
    setSuccessTone(true);
    setMessage("Đã đặt lại mật khẩu. Bạn có thể đăng nhập bằng mật khẩu mới.");
    window.setTimeout(() => window.location.assign("/login"), 900);
  }

  return (
    <main className="min-h-screen bg-[#FFF3EC] px-4 py-8 text-[#5B342C]">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-xl items-center">
        <form onSubmit={resetPassword} className="w-full rounded-[2rem] border border-[#F4C7C4] bg-white/95 p-6 shadow-[0_20px_60px_rgba(127,69,60,0.16)]">
          <p className="text-sm font-black uppercase tracking-[0.18em] text-[#E88498]">Khôi phục tài khoản</p>
          <h1 className="mt-2 text-3xl font-black text-[#5B342C]">Quên mật khẩu</h1>
          <p className="mt-2 text-sm font-semibold text-[#9B746B]">Nhập email tài khoản để nhận OTP rồi tạo mật khẩu mới.</p>

          <div className="mt-7 space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-[#7B554D]">Email</span>
              <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                <Input className="rounded-2xl border-[#F1C5C1] bg-[#FFF9F4]" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
                <Button type="button" variant="secondary" className="h-12 rounded-2xl" disabled={sendingOtp || !form.email} onClick={sendOtp}>
                  {sendingOtp ? <Loader2 className="animate-spin" size={17} /> : <Send size={17} />}
                  Gửi OTP
                </Button>
              </div>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-bold text-[#7B554D]">OTP email</span>
              <Input className="rounded-2xl border-[#F1C5C1] bg-[#FFF9F4]" inputMode="numeric" maxLength={6} value={form.otp} onChange={(event) => setForm({ ...form, otp: event.target.value.replace(/\D/g, "").slice(0, 6) })} />
            </label>

            <PasswordBox label="Mật khẩu mới" value={form.password} visible={showPassword} onToggle={() => setShowPassword((value) => !value)} onChange={(value) => setForm({ ...form, password: value })} />
            <PasswordBox label="Nhập lại mật khẩu mới" value={form.confirmPassword} visible={showConfirmPassword} onToggle={() => setShowConfirmPassword((value) => !value)} onChange={(value) => setForm({ ...form, confirmPassword: value })} />
          </div>

          <AlertModal isOpen={!!message} message={message} onClose={() => setMessage("")} />

          <Button className="mt-6 h-12 w-full rounded-2xl bg-[#EA7188] text-white hover:bg-[#DA5E79]" type="submit" disabled={saving}>
            {saving ? <Loader2 className="animate-spin" size={17} /> : <KeyRound size={17} />}
            Đặt lại mật khẩu
          </Button>

          <Link href="/login" className="mt-5 block rounded-2xl border border-[#F4C7C4] bg-white px-4 py-3 text-center text-sm font-black text-[#EA7188] shadow-sm transition hover:bg-[#FFF3EC]">
            Quay lại đăng nhập
          </Link>
        </form>
      </section>
    </main>
  );
}

function PasswordBox({ label, value, visible, onToggle, onChange }: { label: string; value: string; visible: boolean; onToggle: () => void; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-[#7B554D]">{label}</span>
      <span className="relative block">
        <Input className="rounded-2xl border-[#F1C5C1] bg-[#FFF9F4] pr-12" type={visible ? "text" : "password"} value={value} onChange={(event) => onChange(event.target.value)} />
        <button type="button" onClick={onToggle} className="absolute right-3 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-xl text-[#9B746B] hover:bg-[#FFEAF0]">
          {visible ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </span>
    </label>
  );
}
