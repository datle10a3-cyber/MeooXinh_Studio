"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Bell,
  Building2,
  CalendarDays,
  Camera,
  Check,
  KeyRound,
  Eye,
  EyeOff,
  Loader2,
  LogOut,
  Mail,
  MonitorSmartphone,
  Moon,
  Pencil,
  Phone,
  ShieldCheck,
  Trash2,
  Upload,
  Users,
  WalletCards,
  X,
  type LucideIcon,
} from "lucide-react";
import { AvatarUser, userInitials } from "@/app/components/profile/avatar-user";
import { ActivityLogView } from "@/app/components/activity/activity-log-view";
import type { ProfileAuditLog } from "@/app/components/profile/history-list";
import { Button } from "@/app/components/ui/button";
import { useUiStore } from "@/app/store/ui-store";
import type { CurrentSession } from "@/app/types/auth";
import { cn } from "@/app/utils/cn";
import { AlertModal } from "@/app/components/ui/alert-modal";

type ProfileSummary = {
  user: CurrentSession["user"];
  studio: CurrentSession["studio"];
  stats: {
    monthlyBookings: number;
    monthlyRevenue: number;
    customers: number;
  };
  auditLogs: ProfileAuditLog[];
};

type AvatarResult = {
  data?: { avatarUrl: string; user: CurrentSession["user"] };
  error?: { message: string };
};

type LoginSession = {
  id: string;
  name: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  isCurrent: boolean;
  lastUsedAt?: string | null;
  createdAt: string;
  expiresAt: string;
};

type ProfileForm = {
  name: string;
  email: string;
  phone: string;
};

type StudioForm = {
  name: string;
  email: string;
  phone: string;
  address: string;
};

type PasswordForm = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

type StudioPasswordForm = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

const money = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 });

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

async function cropSquare(file: File) {
  const bitmap = await createImageBitmap(file);
  const size = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, (bitmap.width - size) / 2, (bitmap.height - size) / 2, size, size, 0, 0, 512, 512);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
  return blob ? new File([blob], "avatar.jpg", { type: "image/jpeg" }) : file;
}

function profileForm(user: CurrentSession["user"]): ProfileForm {
  return {
    name: user.name,
    email: user.email,
    phone: user.phone ?? "",
  };
}

function studioForm(studio: CurrentSession["studio"]): StudioForm {
  return {
    name: studio?.name ?? "",
    email: studio?.email ?? "",
    phone: studio?.phone ?? "",
    address: studio?.address ?? "",
  };
}

export function ProfilePage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [summary, setSummary] = useState<ProfileSummary | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [notifyEnabled, setNotifyEnabled] = useState(true);
  const [isTogglingNotify, setIsTogglingNotify] = useState(false);
  const [loginSessions, setLoginSessions] = useState<LoginSession[]>([]);
  const [showAllLoginSessions, setShowAllLoginSessions] = useState(false);
  const [loggingOutAll, setLoggingOutAll] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [editingStudio, setEditingStudio] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [changingStudioPassword, setChangingStudioPassword] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingStudio, setSavingStudio] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [savingStudioPassword, setSavingStudioPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [studioPasswordMessage, setStudioPasswordMessage] = useState("");
  const [studioPasswordSuccess, setStudioPasswordSuccess] = useState(false);
  const [visiblePasswords, setVisiblePasswords] = useState<Record<keyof PasswordForm, boolean>>({
    currentPassword: false,
    newPassword: false,
    confirmPassword: false,
  });
  const [visibleStudioPasswords, setVisibleStudioPasswords] = useState<Record<keyof StudioPasswordForm, boolean>>({
    currentPassword: false,
    newPassword: false,
    confirmPassword: false,
  });
  const [profile, setProfile] = useState<ProfileForm>({ name: "", email: "", phone: "" });
  const [studio, setStudio] = useState<StudioForm>({ name: "", email: "", phone: "", address: "" });
  const [password, setPassword] = useState<PasswordForm>({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [studioPassword, setStudioPassword] = useState<StudioPasswordForm>({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [deletePassword, setDeletePassword] = useState("");
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [visibleDeletePassword, setVisibleDeletePassword] = useState(false);
  const { darkMode, setDarkMode } = useUiStore();

  async function currentPushSubscription() {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return null;
    const registration = await navigator.serviceWorker.ready;
    return registration.pushManager.getSubscription();
  }

  const refreshPushState = useCallback(async function refreshPushState() {
    // Không chỉ kiểm tra subscription cục bộ mà ưu tiên setting trong DB
    if (summary?.user) {
      setNotifyEnabled(summary.user.notificationsEnabled ?? false);
    }
  }, [summary]);

  async function enablePushNotifications() {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      setNotifyEnabled(false);
      setMessage("Thiết bị này chưa hỗ trợ thông báo nền.");
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      setNotifyEnabled(false);
      setMessage("Bạn chưa cấp quyền thông báo cho thiết bị này.");
      return;
    }
    const keyResult = await fetch("/api/push/subscribe").then((res) => res.json()).catch(() => null);
    const publicKey = keyResult?.data?.publicKey;
    if (!publicKey) {
      setNotifyEnabled(false);
      setMessage("Chưa cấu hình khóa thông báo.");
      return;
    }
    const registration = await navigator.serviceWorker.ready;
    const existing = await registration.pushManager.getSubscription();
    const subscription = existing ?? await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
    const saved = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(subscription),
    }).then((res) => res.json()).catch(() => null);
    setNotifyEnabled(Boolean(saved?.data?.enabled));
    setMessage(saved?.data?.enabled ? "Đã bật thông báo trên thiết bị này." : "Chưa bật được thông báo.");
  }

  async function disablePushNotifications() {
    const subscription = await currentPushSubscription().catch(() => null);
    if (subscription) {
      await fetch("/api/push/subscribe", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription),
      }).catch(() => null);
      await subscription.unsubscribe().catch(() => null);
    }
    setNotifyEnabled(false);
    setMessage("Đã tắt thông báo trên thiết bị này.");
  }

  async function toggleNotifications() {
    if (!summary || isTogglingNotify) return;
    const nextValue = !notifyEnabled;
    
    setIsTogglingNotify(true);
    setNotifyEnabled(nextValue); // Optimistic update

    // 1. Lưu vào DB (chỉ gửi field cần thiết)
    const result = await fetch("/api/profile/summary", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user: { notificationsEnabled: nextValue } }),
    }).then((res) => res.json()).catch(() => null);

    if (result?.data) {
      setSummary((curr) => curr ? { ...curr, user: result.data.user } : null);
      window.dispatchEvent(new CustomEvent("studio-session-updated", { detail: { user: result.data.user, studio: result.data.studio } }));
      setMessage(nextValue ? "Đã bật nhận thông báo hệ thống." : "Đã tắt nhận thông báo hệ thống.");
    } else if (result?.error) {
      setNotifyEnabled(!nextValue); // Revert on error
      setMessage(result.error.message);
    }

    // 2. Xử lý subscription thiết bị
    if (nextValue) {
      await enablePushNotifications();
    } else {
      await disablePushNotifications();
    }
    setIsTogglingNotify(false);
  }

  useEffect(() => {
    let active = true;
    async function loadProfile() {
      const result = await fetch("/api/profile/summary", { cache: "no-store" })
        .then((res) => res.json())
        .catch(() => null);
      if (!active) return;
      if (result?.data) {
        setSummary(result.data);
        setPreview(result.data.user.avatarUrl ?? null);
        setProfile(profileForm(result.data.user));
        setStudio(studioForm(result.data.studio));
      }
    }
    void loadProfile();
    return () => {
      active = false;
    };
  }, []);

  async function loadLoginSessions() {
    const result = await fetch("/api/profile/sessions")
      .then((res) => res.json())
      .catch(() => null);
    setLoginSessions(result?.data ?? []);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void loadLoginSessions(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void refreshPushState(), 0);
    return () => window.clearTimeout(timer);
  }, [refreshPushState]);

  const session = useMemo<CurrentSession | null>(() => {
    if (!summary) return null;
    return { user: summary.user, studio: summary.studio };
  }, [summary]);

  const canEditStudio = summary?.user.role === "ADMIN" || summary?.user.role === "MANAGER";
  const visibleLoginSessions = showAllLoginSessions ? loginSessions : loginSessions.slice(0, 3);

  async function upload(file?: File) {
    if (!file || !summary || !session) return;
    if (file.size > 2 * 1024 * 1024) {
      setMessage("Ảnh đại diện tối đa 2MB.");
      return;
    }

    setUploading(true);
    setMessage("");
    const cropped = await cropSquare(file);
    setPreview(URL.createObjectURL(cropped));
    const form = new FormData();
    form.append("file", cropped);
    const result = await fetch("/api/profile/avatar", { method: "POST", body: form })
      .then((res) => res.json() as Promise<AvatarResult>)
      .catch(() => null);
    setUploading(false);

    if (result?.error) {
      setMessage(result.error.message);
      return;
    }
    if (result?.data) {
      const nextSummary = { ...summary, user: result.data.user };
      const nextSession = { user: result.data.user, studio: summary.studio };
      setSummary(nextSummary);
      setProfile(profileForm(result.data.user));
      setPreview(result.data.avatarUrl);
      setMessage("Đã cập nhật ảnh đại diện.");
      window.dispatchEvent(new CustomEvent("studio-session-updated", { detail: nextSession }));
    }
  }

  async function saveProfile() {
    if (!summary) return;
    setSavingProfile(true);
    setMessage("");
    const result = await fetch("/api/profile/summary", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user: profile }),
    })
      .then((res) => res.json())
      .catch(() => null);
    setSavingProfile(false);

    if (result?.error) {
      setMessage(result.error.message);
      return;
    }
    if (result?.data) {
      const nextSummary = { ...summary, user: result.data.user, studio: result.data.studio };
      setSummary(nextSummary);
      setProfile(profileForm(result.data.user));
      setEditingProfile(false);
      setMessage("Đã lưu thông tin cá nhân.");
      window.dispatchEvent(new CustomEvent("studio-session-updated", { detail: { user: result.data.user, studio: result.data.studio } }));
    }
  }

  async function saveStudio() {
    if (!summary) return;
    setSavingStudio(true);
    setMessage("");
    const result = await fetch("/api/profile/summary", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studio }),
    })
      .then((res) => res.json())
      .catch(() => null);
    setSavingStudio(false);

    if (result?.error) {
      setMessage(result.error.message);
      return;
    }
    if (result?.data) {
      const nextSummary = { ...summary, user: result.data.user, studio: result.data.studio };
      setSummary(nextSummary);
      setStudio(studioForm(result.data.studio));
      setEditingStudio(false);
      setMessage("Đã lưu thông tin studio.");
      window.dispatchEvent(new CustomEvent("studio-session-updated", { detail: { user: result.data.user, studio: result.data.studio } }));
    }
  }

  async function submitPassword() {
    setPasswordMessage("");
    setPasswordSuccess(false);
    if (!password.currentPassword || !password.newPassword || !password.confirmPassword) {
      setPasswordMessage("Vui lòng nhập đầy đủ mật khẩu.");
      return;
    }
    if (password.newPassword.length < 8) {
      setPasswordMessage("Mật khẩu mới phải có ít nhất 8 ký tự.");
      return;
    }
    if (password.newPassword !== password.confirmPassword) {
      setPasswordMessage("Mật khẩu xác nhận không khớp.");
      return;
    }

    setSavingPassword(true);
    const result = await fetch("/api/profile/password", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(password),
    })
      .then((res) => res.json())
      .catch(() => null);
    setSavingPassword(false);

    if (result?.error) {
      setPasswordMessage(result.error.message);
      return;
    }
    if (result?.data) {
      setPassword({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setChangingPassword(false);
      setPasswordMessage("Đã đổi mật khẩu. Các phiên đăng nhập khác đã được đăng xuất.");
      setPasswordSuccess(true);
    }
  }

  async function submitStudioPassword() {
    setStudioPasswordMessage("");
    setStudioPasswordSuccess(false);
    if (!studioPassword.currentPassword || !studioPassword.newPassword || !studioPassword.confirmPassword) {
      setStudioPasswordMessage("Vui lòng nhập đầy đủ mật khẩu studio.");
      return;
    }
    if (!/^\d{6}$/.test(studioPassword.currentPassword) || !/^\d{6}$/.test(studioPassword.newPassword) || !/^\d{6}$/.test(studioPassword.confirmPassword)) {
      setStudioPasswordMessage("Mật khẩu studio phải gồm đúng 6 số.");
      return;
    }
    if (studioPassword.newPassword !== studioPassword.confirmPassword) {
      setStudioPasswordMessage("Mật khẩu xác nhận không khớp.");
      return;
    }

    setSavingStudioPassword(true);
    const result = await fetch("/api/profile/studio-password", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(studioPassword),
    })
      .then((res) => res.json())
      .catch(() => null);
    setSavingStudioPassword(false);

    if (result?.error) {
      setStudioPasswordMessage(result.error.message);
      return;
    }
    if (result?.data) {
      setStudioPassword({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setChangingStudioPassword(false);
      setStudioPasswordMessage("Đã đổi mật khẩu studio.");
      setStudioPasswordSuccess(true);
    }
  }

  async function logoutAllDevices() {
    setLoggingOutAll(true);
    const result = await fetch("/api/profile/logout-devices", { method: "POST" })
      .then((res) => res.json())
      .catch(() => null);
    setLoggingOutAll(false);
    setMessage(result?.data ? "Đã đăng xuất các thiết bị khác. Thiết bị này vẫn được giữ đăng nhập." : "Không thể đăng xuất thiết bị lúc này.");
    void loadLoginSessions();
  }

  async function revokeSession(id: string) {
    const result = await fetch(`/api/profile/sessions?id=${encodeURIComponent(id)}`, { method: "DELETE" })
      .then((res) => res.json())
      .catch(() => null);
    setMessage(result?.data ? "Đã đăng xuất thiết bị đã chọn." : result?.error?.message ?? "Không thể đăng xuất thiết bị.");
    void loadLoginSessions();
  }

  async function deleteAccount() {
    if (!deletePassword) {
      setMessage("Vui lòng nhập mật khẩu hiện tại để xóa tài khoản.");
      return;
    }
    setDeletingAccount(true);
    setMessage("");
    const result = await fetch("/api/profile/account", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: deletePassword }),
    }).then((res) => res.json()).catch(() => null);
    setDeletingAccount(false);
    if (result?.error) {
      setMessage(result.error.message);
      return;
    }
    window.location.assign("/login");
  }

  if (!summary) {
    return (
      <div className="space-y-5">
        <div className="h-48 animate-pulse rounded-[2rem] bg-white/70 shadow-sm" />
        <div className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="h-96 animate-pulse rounded-[2rem] bg-white/70 shadow-sm" />
          <div className="h-96 animate-pulse rounded-[2rem] bg-white/70 shadow-sm" />
        </div>
      </div>
    );
  }

  const role = summary.user.role === "ADMIN" ? "Quản trị viên" : summary.user.role === "MANAGER" ? "Quản lý" : "Nhân viên";

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-[1.5rem] border border-[#F4C7C4] bg-white shadow-sm sm:rounded-[2rem]">
        <div className="bg-[#FFF3EC] px-4 py-4 sm:px-6 sm:py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-3 sm:gap-4">
              <div className="relative">
                <AvatarUser name={summary.user.name} avatarUrl={preview} className="h-16 w-16 text-xl shadow-sm sm:h-24 sm:w-24 sm:text-2xl" />
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="absolute bottom-0 right-0 grid h-8 w-8 place-items-center rounded-full border border-[#F4C7C4] bg-white text-[#5B342C] shadow-sm transition hover:scale-105 sm:bottom-1 sm:right-1 sm:h-9 sm:w-9"
                  aria-label="Đổi avatar"
                >
                  <Camera size={17} />
                </button>
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-[#9A8E80] sm:text-sm">Trang cá nhân</p>
                <h1 className="whitespace-normal break-words text-2xl font-bold leading-7 text-[#5B342C] sm:text-3xl sm:leading-9">{summary.user.name}</h1>
                <p className="mt-1 whitespace-normal break-words text-sm leading-5 text-[#9B746B]">{summary.user.email}</p>
                <span className="mt-3 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-[#5B342C] shadow-sm">
                  <ShieldCheck size={14} />
                  {role}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
              <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(event) => void upload(event.target.files?.[0])} />
              <Button className="w-full sm:w-auto" variant="accent" onClick={() => inputRef.current?.click()} disabled={uploading}>
                {uploading ? <Loader2 className="animate-spin" size={17} /> : <Upload size={17} />}
                Upload ảnh
              </Button>
              <Button className="w-full sm:w-auto" variant="secondary" onClick={() => inputRef.current?.click()}>
                <Camera size={17} />
                Đổi nhanh avatar
              </Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 p-4 sm:gap-3 sm:p-5">
          <StatCard icon={CalendarDays} label="Booking tháng" value={summary.stats.monthlyBookings.toLocaleString("vi-VN")} />
          <StatCard icon={WalletCards} label="Doanh thu tháng" value={money.format(summary.stats.monthlyRevenue)} />
          <StatCard icon={Users} label="Số khách" value={summary.stats.customers.toLocaleString("vi-VN")} />
        </div>
      </section>

      <AlertModal isOpen={!!message} message={message} onClose={() => setMessage("")} />

      <div className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr] xl:gap-5">
        <div className="contents xl:block xl:space-y-5">
          <Panel
            className="order-1"
            title="Thông tin cá nhân"
            icon={Users}
            action={<PanelActions editing={editingProfile} saving={savingProfile} onEdit={() => setEditingProfile(true)} onCancel={() => { setProfile(profileForm(summary.user)); setEditingProfile(false); }} onSave={() => void saveProfile()} />}
          >
            {editingProfile ? (
              <div className="space-y-3">
                <EditField label="Tên" value={profile.name} onChange={(value) => setProfile((current) => ({ ...current, name: value }))} />
                <EditField label="Email" type="email" value={profile.email} onChange={(value) => setProfile((current) => ({ ...current, email: value }))} />
                <EditField label="SĐT" value={profile.phone} onChange={(value) => setProfile((current) => ({ ...current, phone: value }))} />
              </div>
            ) : (
              <>
                <InfoRow label="Tên" value={summary.user.name} />
                <InfoRow label="Email" value={summary.user.email} icon={Mail} />
                <InfoRow label="SĐT" value={summary.user.phone || "Chưa cập nhật"} icon={Phone} />
              </>
            )}
          </Panel>

          <Panel className="order-4" title="Bảo mật" icon={KeyRound}>
            {!changingPassword ? (
            <button type="button" onClick={() => setChangingPassword(true)} className="flex w-full items-center justify-between rounded-2xl bg-[#FFF3EC] px-4 py-3 text-left transition hover:bg-[#EFE6DA]">
              <span>
                <span className="block text-sm font-bold text-[#5B342C]">Đổi mật khẩu</span>
                <span className="text-xs text-[#9B746B]">Cập nhật mật khẩu đăng nhập.</span>
              </span>
              <KeyRound size={18} />
            </button>
            ) : (
              <div className="rounded-2xl bg-[#FFF3EC] p-4">
                <div className="grid gap-3">
                  <PasswordField label="Mật khẩu hiện tại" visible={visiblePasswords.currentPassword} onToggle={() => setVisiblePasswords((current) => ({ ...current, currentPassword: !current.currentPassword }))} value={password.currentPassword} onChange={(value) => setPassword((current) => ({ ...current, currentPassword: value }))} />
                  <PasswordField label="Mật khẩu mới" visible={visiblePasswords.newPassword} onToggle={() => setVisiblePasswords((current) => ({ ...current, newPassword: !current.newPassword }))} value={password.newPassword} onChange={(value) => setPassword((current) => ({ ...current, newPassword: value }))} />
                  <PasswordField label="Nhập lại mật khẩu mới" visible={visiblePasswords.confirmPassword} onToggle={() => setVisiblePasswords((current) => ({ ...current, confirmPassword: !current.confirmPassword }))} value={password.confirmPassword} onChange={(value) => setPassword((current) => ({ ...current, confirmPassword: value }))} />
                </div>
                {passwordMessage ? (
                  <div className={cn("mt-3 rounded-2xl px-4 py-3 text-sm font-bold", passwordSuccess ? "bg-[#FFF3EC] text-[#A84E61]" : "bg-rose-50 text-rose-700")}>
                    {passwordMessage}
                  </div>
                ) : null}
                <div className="mt-4 flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setPassword({ currentPassword: "", newPassword: "", confirmPassword: "" });
                      setChangingPassword(false);
                    }}
                  >
                    <X size={15} />
                    Hủy
                  </Button>
                  <Button type="button" variant="accent" size="sm" onClick={() => void submitPassword()} disabled={savingPassword}>
                    {savingPassword ? <Loader2 className="animate-spin" size={15} /> : <Check size={15} />}
                    Lưu mật khẩu
                  </Button>
                </div>
              </div>
            )}
            {!changingPassword && passwordMessage ? (
              <div className={cn("rounded-2xl px-4 py-3 text-sm font-bold", passwordSuccess ? "bg-[#FFF3EC] text-[#A84E61]" : "bg-rose-50 text-rose-700")}>
                {passwordMessage}
              </div>
            ) : null}
            <button
              type="button"
              onClick={logoutAllDevices}
              disabled={loggingOutAll}
              className="mt-3 flex w-full items-center justify-between rounded-2xl bg-rose-50 px-4 py-3 text-left text-rose-700 transition hover:bg-rose-100 disabled:opacity-60"
            >
              <span>
                <span className="block text-sm font-bold">Đăng xuất khỏi các thiết bị khác</span>
                <span className="text-xs">Thiết bị đang dùng vẫn được giữ đăng nhập.</span>
              </span>
              {loggingOutAll ? <Loader2 className="animate-spin" size={18} /> : <LogOut size={18} />}
            </button>
            {!showDeleteAccount ? (
              <button
                type="button"
                onClick={() => setShowDeleteAccount(true)}
                className="mt-3 flex w-full items-center justify-between rounded-2xl bg-rose-50 px-4 py-3 text-left text-rose-700 transition hover:bg-rose-100"
              >
                <span>
                  <span className="block text-sm font-bold">Xóa tài khoản này</span>
                  <span className="text-xs">Tài khoản sẽ bị khóa, email cũ được giải phóng và phiên đăng nhập bị thu hồi.</span>
                </span>
                <Trash2 size={18} />
              </button>
            ) : (
              <div className="mt-3 rounded-2xl bg-rose-50 p-4 text-rose-700">
                <p className="text-sm font-black">Xác nhận xóa tài khoản</p>
                <p className="mt-1 text-xs font-semibold">Nhập mật khẩu hiện tại để xác nhận. Hành động này sẽ đăng xuất bạn ngay sau khi xóa.</p>
                <div className="mt-3">
                  <PasswordField label="Mật khẩu hiện tại" visible={visibleDeletePassword} onToggle={() => setVisibleDeletePassword((value) => !value)} value={deletePassword} onChange={setDeletePassword} />
                </div>
                <div className="mt-4 flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setDeletePassword("");
                      setShowDeleteAccount(false);
                    }}
                  >
                    <X size={15} />
                    Hủy
                  </Button>
                  <Button type="button" variant="danger" size="sm" onClick={() => void deleteAccount()} disabled={deletingAccount}>
                    {deletingAccount ? <Loader2 className="animate-spin" size={15} /> : <Trash2 size={15} />}
                    Xóa tài khoản
                  </Button>
                </div>
              </div>
            )}
              <div className="mt-3 rounded-2xl bg-[#FFF3EC] p-3 sm:p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-black text-[#5B342C]">
                  <MonitorSmartphone size={17} />
                  Thiết bị đăng nhập
                </div>
                <Button variant="ghost" size="sm" onClick={() => void loadLoginSessions()}>
                  Làm mới
                </Button>
              </div>
              <div className="grid gap-2">
                {loginSessions.length ? visibleLoginSessions.map((item) => (
                  <div key={item.id} className="grid gap-2 rounded-xl bg-white px-3 py-2 shadow-sm sm:flex sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <p className="whitespace-normal break-words text-sm font-black leading-5 text-[#5B342C]">{item.name}</p>
                        {item.isCurrent ? <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-black text-emerald-700">Đang dùng</span> : null}
                      </div>
                      <p className="mt-0.5 text-xs font-semibold leading-5 text-[#9B746B]">
                        {item.lastUsedAt ? new Date(item.lastUsedAt).toLocaleString("vi-VN") : "Chưa rõ"}
                        {item.ipAddress ? ` · ${item.ipAddress}` : ""}
                      </p>
                    </div>
                    {item.isCurrent ? null : (
                      <Button className="h-9 w-full shrink-0 px-3 sm:w-auto" variant="secondary" size="sm" onClick={() => void revokeSession(item.id)}>
                        Đăng xuất
                      </Button>
                    )}
                  </div>
                )) : (
                  <p className="rounded-xl bg-white px-3 py-4 text-sm font-semibold text-[#9B746B]">Chưa có dữ liệu thiết bị.</p>
                )}
              </div>
              {loginSessions.length > 3 ? (
                <button
                  type="button"
                  className="mt-3 w-full rounded-xl bg-white px-3 py-2 text-sm font-black text-[#EA7188] shadow-sm transition hover:bg-[#FFF8F1]"
                  onClick={() => setShowAllLoginSessions((value) => !value)}
                >
                  {showAllLoginSessions ? "Thu gọn" : `Xem thêm ${loginSessions.length - 3} thiết bị`}
                </button>
              ) : null}
            </div>
          </Panel>

          <Panel className="order-3" title="Cài đặt nhanh" icon={Bell}>
            <ToggleRow icon={Moon} label="Dark mode" checked={darkMode} onChange={() => setDarkMode(!darkMode)} />
            <ToggleRow icon={Bell} label="Thông báo" checked={notifyEnabled} loading={isTogglingNotify} onChange={() => void toggleNotifications()} />
          </Panel>
        </div>

        <div className="contents xl:block xl:space-y-5">
          <Panel
            className="order-2"
            title="Studio"
            icon={Building2}
            action={
              canEditStudio ? (
                <PanelActions editing={editingStudio} saving={savingStudio} onEdit={() => setEditingStudio(true)} onCancel={() => { setStudio(studioForm(summary.studio)); setEditingStudio(false); }} onSave={() => void saveStudio()} />
              ) : null
            }
          >
            <div className="flex items-center gap-3 rounded-2xl bg-[#FFF3EC] p-4">
              <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-[#EA7188] text-lg font-black text-white">
                {userInitials(summary.studio?.name)}
              </div>
              <div className="min-w-0">
                <p className="whitespace-normal break-words text-base font-bold leading-6 text-[#5B342C]">{summary.studio?.name ?? "Studio"}</p>
              </div>
            </div>

            {editingStudio ? (
              <div className="space-y-3">
                <EditField label="Tên studio" value={studio.name} onChange={(value) => setStudio((current) => ({ ...current, name: value }))} />
                <EditField label="SĐT studio" value={studio.phone} onChange={(value) => setStudio((current) => ({ ...current, phone: value }))} />
                <EditField label="Email studio" type="email" value={studio.email} onChange={(value) => setStudio((current) => ({ ...current, email: value }))} />
                <EditField label="Địa chỉ" value={studio.address} onChange={(value) => setStudio((current) => ({ ...current, address: value }))} />
              </div>
            ) : (
              <>
                <InfoRow label="SĐT studio" value={summary.studio?.phone || "Chưa cập nhật"} />
                <InfoRow label="Địa chỉ" value={summary.studio?.address || "Chưa cập nhật"} />
                <InfoRow label="Email" value={summary.studio?.email || "Chưa cập nhật"} />
              </>
            )}
          </Panel>

          {summary.user.role === "ADMIN" ? (
            <Panel className="order-5" title="Mật khẩu studio" icon={KeyRound}>
              {!changingStudioPassword ? (
                <button type="button" onClick={() => setChangingStudioPassword(true)} className="flex w-full items-center justify-between rounded-2xl bg-[#FFF3EC] px-4 py-3 text-left transition hover:bg-[#EFE6DA]">
                  <span>
                    <span className="block text-sm font-bold text-[#5B342C]">Đổi mật khẩu xóa ca</span>
                    <span className="text-xs text-[#9B746B]">Mặc định ban đầu là 000000. Mật khẩu mới phải đúng 6 số.</span>
                  </span>
                  <KeyRound size={18} />
                </button>
              ) : (
                <div className="rounded-2xl bg-[#FFF3EC] p-4">
                  <div className="grid gap-3">
                    <PasswordField label="Mật khẩu studio hiện tại" visible={visibleStudioPasswords.currentPassword} onToggle={() => setVisibleStudioPasswords((current) => ({ ...current, currentPassword: !current.currentPassword }))} value={studioPassword.currentPassword} onChange={(value) => setStudioPassword((current) => ({ ...current, currentPassword: value.replace(/\D/g, "").slice(0, 6) }))} />
                    <PasswordField label="Mật khẩu studio mới" visible={visibleStudioPasswords.newPassword} onToggle={() => setVisibleStudioPasswords((current) => ({ ...current, newPassword: !current.newPassword }))} value={studioPassword.newPassword} onChange={(value) => setStudioPassword((current) => ({ ...current, newPassword: value.replace(/\D/g, "").slice(0, 6) }))} />
                    <PasswordField label="Nhập lại mật khẩu studio mới" visible={visibleStudioPasswords.confirmPassword} onToggle={() => setVisibleStudioPasswords((current) => ({ ...current, confirmPassword: !current.confirmPassword }))} value={studioPassword.confirmPassword} onChange={(value) => setStudioPassword((current) => ({ ...current, confirmPassword: value.replace(/\D/g, "").slice(0, 6) }))} />
                  </div>
                  {studioPasswordMessage ? (
                    <div className={cn("mt-3 rounded-2xl px-4 py-3 text-sm font-bold", studioPasswordSuccess ? "bg-[#FFF3EC] text-[#A84E61]" : "bg-rose-50 text-rose-700")}>
                      {studioPasswordMessage}
                    </div>
                  ) : null}
                  <div className="mt-4 flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setStudioPassword({ currentPassword: "", newPassword: "", confirmPassword: "" });
                        setChangingStudioPassword(false);
                      }}
                    >
                      <X size={15} />
                      Hủy
                    </Button>
                    <Button type="button" variant="accent" size="sm" onClick={() => void submitStudioPassword()} disabled={savingStudioPassword}>
                      {savingStudioPassword ? <Loader2 className="animate-spin" size={15} /> : <Check size={15} />}
                      Lưu mật khẩu studio
                    </Button>
                  </div>
                </div>
              )}
              {!changingStudioPassword && studioPasswordMessage ? (
                <div className={cn("rounded-2xl px-4 py-3 text-sm font-bold", studioPasswordSuccess ? "bg-[#FFF3EC] text-[#A84E61]" : "bg-rose-50 text-rose-700")}>
                  {studioPasswordMessage}
                </div>
              ) : null}
            </Panel>
          ) : null}

          <div className="order-6">
            <ActivityLogView compact />
          </div>
        </div>
      </div>
    </div>
  );
}

function Panel({ title, icon: Icon, action, children, className }: { title: string; icon: LucideIcon; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-[1.35rem] border border-[#F4C7C4] bg-white p-4 shadow-sm sm:rounded-[1.5rem] sm:p-5", className)}>
      <div className="mb-3 flex items-center justify-between gap-3 sm:mb-4">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-2xl bg-[#FFF3EC] text-[#5B342C] sm:h-10 sm:w-10">
            <Icon size={18} />
          </span>
          <h2 className="text-base font-bold text-[#5B342C] sm:text-lg">{title}</h2>
        </div>
        {action}
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function PanelActions({ editing, saving, onEdit, onCancel, onSave }: { editing: boolean; saving: boolean; onEdit: () => void; onCancel: () => void; onSave: () => void }) {
  if (!editing) {
    return (
      <Button type="button" variant="secondary" size="sm" onClick={onEdit}>
        <Pencil size={15} />
        Sửa
      </Button>
    );
  }

  return (
    <div className="flex gap-2">
      <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
        <X size={15} />
        Hủy
      </Button>
      <Button type="button" variant="accent" size="sm" onClick={onSave} disabled={saving}>
        {saving ? <Loader2 className="animate-spin" size={15} /> : <Check size={15} />}
        Lưu
      </Button>
    </div>
  );
}

function EditField({ label, value, type = "text", onChange }: { label: string; value: string; type?: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-[#9A8E80]">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 w-full rounded-2xl border border-[#F4C7C4] bg-[#FDFBF8] px-4 text-sm font-semibold text-[#5B342C] outline-none transition focus:border-[#EA7188] focus:bg-white focus:ring-4 focus:ring-[#EA7188]/20"
      />
    </label>
  );
}

function PasswordField({
  label,
  value,
  visible,
  onToggle,
  onChange,
}: {
  label: string;
  value: string;
  visible: boolean;
  onToggle: () => void;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-[#9A8E80]">{label}</span>
      <span className="relative block">
        <input
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-12 w-full rounded-2xl border border-[#F4C7C4] bg-white px-4 pr-12 text-sm font-semibold text-[#5B342C] outline-none transition focus:border-[#EA7188] focus:bg-white focus:ring-4 focus:ring-[#EA7188]/20"
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-3 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-xl text-[#9B746B] transition hover:bg-[#FFF3EC] hover:text-[#5B342C]"
          aria-label={visible ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
        >
          {visible ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </span>
    </label>
  );
}

function InfoRow({ label, value, icon: Icon }: { label: string; value: string; icon?: LucideIcon }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl px-1 py-2">
      {Icon ? (
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#FFF3EC] text-[#9B746B]">
          <Icon size={16} />
        </span>
      ) : null}
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold uppercase tracking-wide text-[#9A8E80]">{label}</p>
        <p className="whitespace-normal break-words text-sm font-bold leading-5 text-[#5B342C]">{value}</p>
      </div>
    </div>
  );
}

function ToggleRow({ icon: Icon, label, checked, loading, onChange }: { icon: LucideIcon; label: string; checked: boolean; loading?: boolean; onChange: () => void }) {
  return (
    <button type="button" onClick={onChange} disabled={loading} className="flex w-full items-center justify-between rounded-2xl px-2 py-2 transition hover:bg-[#FFF3EC] disabled:opacity-70">
      <span className="inline-flex items-center gap-3 text-sm font-bold text-[#5B342C]">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#FFF3EC] text-[#9B746B]">
          {loading ? <Loader2 className="animate-spin" size={16} /> : <Icon size={16} />}
        </span>
        {label}
      </span>
      <span className={cn("h-6 w-11 rounded-full p-1 transition", checked ? "bg-[#EA7188]" : "bg-[#F4C7C4]")}>
        <span className={cn("block h-4 w-4 rounded-full bg-white transition", checked ? "translate-x-5" : "translate-x-0")} />
      </span>
    </button>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-[1.1rem] border border-[#F4C7C4] bg-white p-2.5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:rounded-[1.35rem] sm:p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="grid h-8 w-8 place-items-center rounded-2xl bg-[#FFF3EC] text-[#5B342C] sm:h-10 sm:w-10">
          <Icon size={16} />
        </span>
      </div>
      <p className="mt-2 text-[10px] font-bold uppercase leading-4 tracking-wide text-[#9A8E80] sm:mt-3 sm:text-xs">{label}</p>
      <p className="mt-1 whitespace-normal break-words text-base font-black leading-5 text-[#5B342C] sm:text-xl sm:leading-7">{value}</p>
    </div>
  );
}




