"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bell, CheckCheck, Volume2 } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/app/components/ui/button";
import { useUiStore } from "@/app/store/ui-store";
import { navigateStudioPath, navigateStudioView, studioViewPath } from "@/app/utils/studio-navigation";

type NotificationItem = {
  id: string;
  sourceId: string;
  type: "booking" | "invoice" | "project" | "notification";
  title: string;
  message: string;
  createdAt: string;
  isRead: boolean;
  targetResource: string;
  targetPath: string;
};

function timeAgo(value: string) {
  const diff = new Date(value).getTime() - Date.now();
  const abs = Math.abs(diff);
  const minutes = Math.max(1, Math.round(abs / 60000));
  if (minutes < 60) return diff >= 0 ? `${minutes} phút nữa` : `${minutes} phút trước`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return diff >= 0 ? `${hours} giờ nữa` : `${hours} giờ trước`;
  const days = Math.round(hours / 24);
  return diff >= 0 ? `${days} ngày nữa` : `${days} ngày trước`;
}

function readIds() {
  if (typeof window === "undefined") return new Set<string>();
  try {
    return new Set(JSON.parse(window.localStorage.getItem("studio_read_notifications") ?? "[]") as string[]);
  } catch {
    return new Set<string>();
  }
}

function saveReadIds(ids: Set<string>) {
  window.localStorage.setItem("studio_read_notifications", JSON.stringify([...ids]));
}

function notificationKey(id: string) {
  const day = new Date().toISOString().slice(0, 10);
  return `studio_notify_count_${day}_${id}`;
}

function canSendBrowserNotification(id: string) {
  if (typeof window === "undefined") return false;
  const key = notificationKey(id);
  const count = Number(window.localStorage.getItem(key) ?? "0");
  if (count >= 1) return false;
  window.localStorage.setItem(key, String(count + 1));
  return true;
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

function isStandalonePwa() {
  const navigatorWithStandalone = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || navigatorWithStandalone.standalone === true;
}

function isAppleMobileDevice() {
  return /iPad|iPhone|iPod/.test(window.navigator.userAgent) || (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1);
}

function pushRequirementMessage() {
  const isLocalhost = ["localhost", "127.0.0.1"].includes(window.location.hostname);
  const isInternalIp = /^192\.168\.|^10\.|^172\.(1[6-9]|2\d|3[0-1])\./.test(window.location.hostname);

  if (!window.isSecureContext) {
    if (isInternalIp) return "iPhone không cho bật thông báo trên link nội bộ HTTP. Cần deploy HTTPS rồi thêm lại app vào màn hình chính.";
    if (!isLocalhost) return "Thông báo điện thoại cần chạy trên HTTPS.";
  }

  if (!("serviceWorker" in navigator)) return "Trình duyệt này chưa hỗ trợ service worker.";
  if (!("PushManager" in window) || !("Notification" in window)) return "Thiết bị này chưa hỗ trợ thông báo nền.";
  if (isAppleMobileDevice() && !isStandalonePwa()) return "iPhone/iPad cần mở app từ biểu tượng đã thêm vào màn hình chính.";
  return "";
}

export function NotificationBell() {
  const router = useRouter();
  const pathname = usePathname();
  const rootRef = useRef<HTMLDivElement>(null);
  const setActiveResource = useUiStore((state) => state.setActiveResource);
  const setFocusedItemId = useUiStore((state) => state.setFocusedItemId);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [read, setRead] = useState<Set<string>>(() => readIds());
  const [toast, setToast] = useState("");
  const [pushEnabled, setPushEnabled] = useState(false);

  function showToast(message: string, duration = 3500) {
    setToast(message);
    window.setTimeout(() => setToast(""), duration);
  }

  const savePushSubscription = useCallback(async (subscription: PushSubscription) => {
    const saved = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(subscription),
    })
      .then((res) => res.json())
      .catch(() => null);
    const enabled = Boolean(saved?.data?.enabled);
    setPushEnabled(enabled);
    return enabled;
  }, []);

  async function enablePushNotifications() {
    const requirementMessage = pushRequirementMessage();
    if (requirementMessage) {
      showToast(requirementMessage, 6500);
      return;
    }

    if (false && !window.isSecureContext) {
      showToast("Thông báo điện thoại cần HTTPS hoặc cài app PWA từ màn hình chính.", 5000);
      return;
    }

    if (false && (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window))) {
      showToast("Thiết bị hoặc trình duyệt này chưa hỗ trợ thông báo nền.", 4500);
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        showToast("Bạn chưa cấp quyền thông báo.");
        return;
      }

      const keyResult = await fetch("/api/push/subscribe")
        .then((res) => res.json())
        .catch(() => null);
      const publicKey = keyResult?.data?.publicKey;
      if (!publicKey) {
        showToast("Chưa cấu hình khóa thông báo.");
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const currentSubscription = await registration.pushManager.getSubscription();
      const subscription =
        currentSubscription ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        }));
      const enabled = await savePushSubscription(subscription);
      showToast(enabled ? "Đã bật thông báo trên thiết bị này." : "Chưa bật được thông báo.");
    } catch {
      showToast("Chưa bật được thông báo. iPhone/iPad cần mở app PWA từ màn hình chính; Android cần Chrome/Edge trên HTTPS và cho phép thông báo.", 6500);
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function syncCurrentDeviceSubscription() {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
      if ("Notification" in window && Notification.permission !== "granted") return;
      const registration = await navigator.serviceWorker.ready.catch(() => null);
      const subscription = await registration?.pushManager.getSubscription().catch(() => null);
      if (!subscription || cancelled) return;
      const enabled = await savePushSubscription(subscription).catch(() => false);
      if (!cancelled) setPushEnabled(enabled);
    }

    void syncCurrentDeviceSubscription();
    return () => {
      cancelled = true;
    };
  }, [savePushSubscription]);

  useEffect(() => {
    if (!open) return;

    function closeOnOutside(event: PointerEvent) {
      if (!(event.target instanceof Node)) return;
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    }

    document.addEventListener("pointerdown", closeOnOutside);
    return () => document.removeEventListener("pointerdown", closeOnOutside);
  }, [open]);

  useEffect(() => {
    async function load() {
      const result = await fetch("/api/notifications")
        .then((res) => res.json())
        .catch(() => null);
      if (result?.data) {
        const next = result.data as NotificationItem[];
        setItems(next);
        
        // Đồng bộ lại danh sách 'đã đọc' cục bộ với DB
        // Nếu DB bảo là chưa đọc (isRead: false) thì phải xóa khỏi Set 'read' để nó hiện lại lên chuông
        setRead((current) => {
          const nextRead = new Set(current);
          let changed = false;
          next.forEach(item => {
            if (!item.isRead && nextRead.has(item.id)) {
              nextRead.delete(item.id);
              changed = true;
            }
          });
          if (changed) {
            saveReadIds(nextRead);
            return nextRead;
          }
          return current;
        });

        const urgent = next.find((item) => !item.isRead && !read.has(item.id));
        if (urgent) {
          showToast(urgent.title);
          if ("Notification" in window && canSendBrowserNotification(urgent.id)) {
            if (Notification.permission === "granted") {
              new Notification(urgent.title, { body: urgent.message });
            } else if (Notification.permission !== "denied") {
              Notification.requestPermission().then((permission) => {
                if (permission === "granted") new Notification(urgent.title, { body: urgent.message });
              });
            }
          }
        }
      }
    }

    const first = window.setTimeout(() => void load(), 0);
    const timer = window.setInterval(() => void load(), 10000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, [read]);

  const unreadCount = useMemo(() => items.filter((item) => !item.isRead && !read.has(item.id)).length, [items, read]);

  function markRead(ids: string[], sourceIds: string[] = []) {
    const next = new Set(read);
    ids.forEach((id) => next.add(id));
    setRead(next);
    saveReadIds(next);
    void fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids, sourceIds }),
    }).catch(() => null);
  }

  function openItem(item: NotificationItem) {
    markRead([item.id], [item.sourceId]);
    setItems((current) => current.map((row) => (row.id === item.id ? { ...row, isRead: true } : row)));
    setOpen(false);
    setActiveResource(item.targetResource);
    setFocusedItemId(item.sourceId);
    const targetPath = !item.targetPath || item.targetPath === "/" ? studioViewPath(item.targetResource) : item.targetPath;
    navigateStudioPath(router, pathname, targetPath);
  }

  return (
    <div ref={rootRef} className="relative">
      <Button variant="secondary" size="icon" aria-label="Thông báo" onClick={() => setOpen((value) => !value)}>
        <Bell size={17} />
        {unreadCount ? (
          <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-rose-500 px-1 text-[11px] font-black text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </Button>

      {open ? (
        <div className="fixed left-2 right-2 top-16 z-50 overflow-hidden rounded-2xl border border-[#F4C7C4] bg-white shadow-xl sm:absolute sm:left-auto sm:right-0 sm:top-14 sm:w-[360px]">
          <div className="flex items-center justify-between border-b border-[#F4C7C4] px-4 py-3">
            <div>
              <p className="font-bold text-[#5B342C]">Thông báo</p>
              <p className="text-xs text-[#9B746B]">{unreadCount} mục cần xem</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                markRead(
                  items.map((item) => item.id),
                  items.map((item) => item.sourceId),
                );
                setItems((current) => current.map((item) => ({ ...item, isRead: true })));
              }}
            >
              <CheckCheck size={15} />
              Đã đọc
            </Button>
          </div>

          <div className="border-b border-[#F4C7C4] p-2">
            <button
              type="button"
              onClick={() => void enablePushNotifications()}
              className="flex w-full items-center justify-between gap-3 rounded-xl bg-[#FFF0F4] px-3 py-2 text-left text-xs font-black text-[#A84E61] transition hover:bg-[#FFE4EA]"
            >
              <span className="inline-flex items-center gap-2">
                <Volume2 size={15} />
                {pushEnabled ? "Đã bật thông báo máy này" : "Bật thông báo trên điện thoại"}
              </span>
              <span>{pushEnabled ? "OK" : "Bật"}</span>
            </button>
          </div>

          <div className="max-h-[65vh] overflow-y-auto p-2 sm:max-h-96">
            {items.length ? (
              items.map((item) => {
                const isRead = item.isRead || read.has(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => openItem(item)}
                    className="block w-full rounded-xl px-3 py-3 text-left transition hover:bg-[#FFF3EC]"
                  >
                    <div className="flex gap-3">
                      <span className={`mt-1 h-2.5 w-2.5 rounded-full ${isRead ? "bg-[#F4C7C4]" : "bg-rose-500"}`} />
                      <span className="min-w-0 flex-1">
                        <span className="block whitespace-normal break-words text-sm font-bold leading-5 text-[#5B342C]">{item.title}</span>
                        <span className="mt-1 block whitespace-normal break-words text-xs leading-5 text-[#9B746B]">{item.message}</span>
                        <span className="mt-1 block text-[11px] font-semibold text-[#EA7188]">{timeAgo(item.createdAt)}</span>
                      </span>
                    </div>
                  </button>
                );
              })
            ) : (
              <p className="px-4 py-8 text-center text-sm text-[#9B746B]">Chưa có việc cần nhắc.</p>
            )}
          </div>

          <div className="border-t border-[#F4C7C4] p-2">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setActiveResource("notifications");
                setFocusedItemId(null);
                navigateStudioView(router, pathname, "notifications");
              }}
              className="w-full rounded-xl px-3 py-2 text-sm font-bold text-[#5B342C] hover:bg-[#FFF3EC]"
            >
              Xem tất cả
            </button>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div className="fixed inset-x-3 bottom-20 z-50 rounded-2xl border border-[#F4C7C4] bg-white px-4 py-3 text-sm font-bold text-[#5B342C] shadow-xl sm:inset-x-auto sm:bottom-5 sm:right-5">
          {toast}
        </div>
      ) : null}
    </div>
  );
}
