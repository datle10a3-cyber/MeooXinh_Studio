"use client";

import { useEffect, useState } from "react";
import { Wifi, WifiOff } from "lucide-react";

export function NetworkStatus() {
  const [isOnline, setIsOnline] = useState(true);
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    setIsOnline(navigator.onLine);

    function handleOnline() {
      setIsOnline(true);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    }

    function handleOffline() {
      setIsOnline(false);
      setShowToast(true);
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (!showToast) return null;

  return (
    <div className="fixed left-0 right-0 top-safe-offset z-[100] flex justify-center p-4 pointer-events-none transition-all duration-300">
      <div
        className={`flex items-center gap-2.5 rounded-full px-4 py-2.5 text-sm font-black text-white shadow-[0_8px_30px_rgba(0,0,0,0.12)] backdrop-blur-md ${
          isOnline ? "bg-[#10B981]/90" : "bg-[#F43F5E]/90"
        }`}
      >
        {isOnline ? <Wifi size={16} /> : <WifiOff size={16} />}
        {isOnline ? "Đã khôi phục kết nối mạng" : "Bạn đang offline"}
      </div>
    </div>
  );
}
