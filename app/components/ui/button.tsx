import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/app/utils/cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-2xl text-sm font-bold transition duration-200 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EA7188]/35",
  {
    variants: {
      variant: {
        primary: "bg-[#EA7188] text-white shadow-sm hover:bg-[#DA5E79]",
        secondary: "border border-[#F4C7C4] bg-white text-[#5B342C] shadow-sm hover:bg-[#FFF0F4]",
        accent: "bg-[#FFE1E8] text-[#A84E61] shadow-sm hover:bg-[#FFD4DF]",
        ghost: "text-[#5B342C] hover:bg-[#FFF0F4]",
        danger: "bg-rose-500 text-white hover:bg-rose-400",
      },
      size: {
        sm: "h-10 px-4",
        md: "h-11 px-5",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>;

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}


