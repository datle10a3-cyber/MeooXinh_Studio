import { memo } from "react";
import { Card } from "@/app/components/ui/card";
import { formatMoney } from "@/app/utils/format";

type StatCardProps = {
  label: string;
  value: number;
  tone?: "income" | "profit" | "expense" | "debt";
};

const toneMap = {
  income: {
    badge: "bg-emerald-50 text-emerald-700",
    value: "text-emerald-700",
    line: "bg-emerald-500",
  },
  expense: {
    badge: "bg-red-50 text-red-600",
    value: "text-red-600",
    line: "bg-red-500",
  },
  profit: {
    badge: "bg-violet-50 text-violet-700",
    value: "text-violet-700",
    line: "bg-violet-500",
  },
  debt: {
    badge: "bg-amber-50 text-amber-700",
    value: "text-amber-700",
    line: "bg-amber-500",
  },
};

export const StatCard = memo(function StatCard({ label, value, tone = "debt" }: StatCardProps) {
  const style = toneMap[tone];

  return (
    <Card className="min-h-24 overflow-hidden p-3 sm:min-h-32 sm:p-6">
      <div className={`h-1.5 w-12 rounded-full sm:w-16 ${style.line}`} />
      <div className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-[10px] font-black sm:mt-4 sm:px-3 sm:text-xs ${style.badge}`}>{label}</div>
      <p className={`mt-2 break-words text-lg font-black leading-tight sm:mt-4 sm:text-2xl ${style.value}`}>{formatMoney(value)}</p>
    </Card>
  );
});
