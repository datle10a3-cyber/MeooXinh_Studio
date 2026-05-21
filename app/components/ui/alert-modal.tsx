"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn } from "@/app/utils/cn";
import { Button } from "@/app/components/ui/button";

import { createPortal } from "react-dom";

interface AlertModalProps {
  isOpen: boolean;
  message: string;
  onClose: () => void;
  title?: string;
}

export function AlertModal({ isOpen, message, onClose, title }: AlertModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setMounted(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  // Sync state with body scroll
  useEffect(() => {
    if (isOpen) {
      document.body.classList.add("studio-alert-open");
    } else {
      document.body.classList.remove("studio-alert-open");
    }
    return () => {
      document.body.classList.remove("studio-alert-open");
    };
  }, [isOpen]);

  if (!mounted || !isOpen) return null;

  // Detect type based on keywords
  const isSuccess = /thành công|đã lưu|cập nhật|đã tạo|hoàn tất|đã xóa|thành công/i.test(message);
  const isError = /lỗi|không đúng|thất bại|không hợp lệ|trùng|chưa nhập|chưa chọn|chưa đăng nhập|phải có|không thể/i.test(message);

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 animate-in fade-in-0 duration-200">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-md" 
        onClick={onClose} 
      />

      {/* Card */}
      <div className="relative w-full max-w-sm transform overflow-hidden rounded-[2rem] border border-white bg-white/95 p-6 text-center shadow-[0_24px_70px_rgba(184,95,108,0.22)] backdrop-blur-xl animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
        
        {/* Header Icon */}
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full mb-4">
          {isSuccess ? (
            <div className="grid h-16 w-16 place-items-center rounded-full bg-emerald-50 text-emerald-600 ring-8 ring-emerald-100/60">
              <CheckCircle2 size={32} />
            </div>
          ) : isError ? (
            <div className="grid h-16 w-16 place-items-center rounded-full bg-rose-50 text-rose-600 ring-8 ring-rose-100/60">
              <AlertTriangle size={32} />
            </div>
          ) : (
            <div className="grid h-16 w-16 place-items-center overflow-hidden rounded-full bg-[#FFF0F4] p-1.5 ring-8 ring-[#FFE4EA]/60 animate-bounce">
              <img src="/be-meo-studio-avatar.svg" alt="Mèoo Xinhh" className="h-full w-full object-cover" />
            </div>
          )}
        </div>

        {/* Title */}
        <h3 className="text-lg font-black text-[#5B342C]">
          {title || (isSuccess ? "Thành công" : isError ? "Thông báo lỗi" : "Mèoo Xinhh nhắc bạn")}
        </h3>

        {/* Message */}
        <p className="mt-3 whitespace-normal break-words text-sm font-semibold leading-relaxed text-[#7B554D]">
          {message}
        </p>

        {/* Actions */}
        <div className="mt-6">
          <Button 
            className={cn(
              "h-12 w-full rounded-2xl text-sm font-black transition-all active:scale-[0.98]",
              isSuccess 
                ? "bg-emerald-600 text-white hover:bg-emerald-700 shadow-[0_8px_20px_rgba(16,185,129,0.2)]" 
                : isError 
                  ? "bg-rose-600 text-white hover:bg-rose-700 shadow-[0_8px_20px_rgba(225,29,72,0.2)]" 
                  : "bg-[#EA7188] text-white hover:bg-[#E85C77] shadow-[0_8px_20px_rgba(234,113,136,0.25)]"
            )}
            onClick={onClose}
          >
            Đồng ý (OK)
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
