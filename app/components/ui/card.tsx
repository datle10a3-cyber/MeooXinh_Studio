import * as React from "react";
import { cn } from "@/app/utils/cn";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <section
      className={cn("min-w-0 rounded-[1.15rem] border border-[#F4C7C4] bg-white p-3 shadow-[0_12px_35px_rgba(184,95,108,0.08)] sm:rounded-[1.75rem] sm:p-6", className)}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn("break-words text-base font-black leading-tight text-[#5B342C] sm:text-lg", className)} {...props} />;
}


