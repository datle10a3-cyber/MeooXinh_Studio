import * as React from "react";
import { cn } from "@/app/utils/cn";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-12 w-full rounded-2xl border border-[#F1C5C1] bg-[#FFF9F4] px-4 text-sm font-semibold text-[#5B342C] outline-none transition placeholder:text-[#B98278] focus:border-[#EA7188] focus:ring-2 focus:ring-[#FFD4DF]",
        className,
      )}
      {...props}
    />
  );
}

export function DateTimeInput({
  label,
  className,
  type = "datetime-local",
  value,
  onChange,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const inputLang = type === "datetime-local" || type === "time" ? "en-GB" : "vi-VN";

  return (
    <label className={cn("block rounded-2xl border border-[#F1C5C1] bg-[#FFF9F4] px-4 py-2 transition focus-within:border-[#EA7188] focus-within:ring-2 focus-within:ring-[#FFD4DF]", className)}>
      <span className="mb-1 block text-xs font-black uppercase tracking-wide text-[#B98278]">{label}</span>
      <input
        {...props}
        type={type}
        value={value}
        onChange={onChange}
        lang={inputLang}
        step={props.step ?? 60}
        className="h-8 w-full bg-transparent text-sm font-black text-[#5B342C] outline-none [color-scheme:light]"
      />
    </label>
  );
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-28 w-full rounded-2xl border border-[#F1C5C1] bg-[#FFF9F4] px-4 py-3 text-sm font-semibold text-[#5B342C] outline-none transition placeholder:text-[#B98278] focus:border-[#EA7188] focus:ring-2 focus:ring-[#FFD4DF]",
        className,
      )}
      {...props}
    />
  );
}


