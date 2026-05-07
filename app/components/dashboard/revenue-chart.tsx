"use client";

import { useEffect, useRef, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardTitle } from "@/app/components/ui/card";
import type { RevenuePoint } from "@/app/types/studio";
import { formatMoney } from "@/app/utils/format";

type ChartMode = "day" | "month" | "year";

const chartColors = {
  income: "#16A34A",
  expense: "#EF4444",
  profit: "#8B5CF6",
};

const titleByMode: Record<ChartMode, string> = {
  day: "Doanh thu theo ngày",
  month: "Doanh thu theo tháng",
  year: "Doanh thu theo năm",
};

const fallbackRangeByMode: Record<ChartMode, string> = {
  day: "Tháng hiện tại",
  month: "Năm hiện tại",
  year: "Khoảng năm",
};

function formatCompactMoney(value: number) {
  const number = Number(value);
  const abs = Math.abs(number);
  const sign = number < 0 ? "-" : "";

  if (abs >= 1_000_000_000) return `${sign}${Math.round(abs / 1_000_000_000)} tỷ`;
  if (abs >= 1_000_000) return `${sign}${Math.round(abs / 1_000_000)}tr`;
  if (abs >= 1_000) return `${sign}${Math.round(abs / 1_000)}k`;
  return `${number}`;
}

function pickXAxisTicks(data: RevenuePoint[], mode: ChartMode) {
  const labels = data.map((item) => String(item.label));

  if (mode === "day") {
    const preferred = new Set(["1", "5", "10", "15", "20", "25", "31"]);
    const picked = labels.filter((label) => preferred.has(label));
    return picked.length ? picked : labels.filter((_, index) => index % 5 === 0 || index === labels.length - 1);
  }

  if (mode === "month") return labels;

  return labels.length > 8 ? labels.filter((_, index) => index % 2 === 0 || index === labels.length - 1) : labels;
}

export function RevenueChart({ data, mode, rangeLabel }: { data: RevenuePoint[]; mode: ChartMode; rangeLabel?: string }) {
  const [mounted, setMounted] = useState(false);
  const chartBoxRef = useRef<HTMLDivElement>(null);
  const [chartWidth, setChartWidth] = useState(0);
  const xAxisHeight = mode === "day" ? 34 : mode === "month" ? 66 : 48;
  const xAxisTicks = pickXAxisTicks(data, mode);
  const xAxisAngle = mode === "day" ? 0 : mode === "month" ? -42 : -28;

  useEffect(() => {
    const timer = window.setTimeout(() => setMounted(true), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!mounted || !chartBoxRef.current) return;
    const element = chartBoxRef.current;
    const update = () => setChartWidth(Math.max(0, Math.floor(element.getBoundingClientRect().width)));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [mounted]);

  return (
    <Card className="min-h-[330px] sm:min-h-[430px]">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>{titleByMode[mode]}</CardTitle>
          <p className="mt-1 text-xs font-semibold text-[#9B746B] sm:text-sm">Đỏ là chi, tím là lợi nhuận, xanh lá là thu.</p>
        </div>
        <span className="w-fit rounded-full bg-[#FFE4EA] px-3 py-1 text-xs font-black text-[#A84E61] sm:text-sm">{rangeLabel ?? fallbackRangeByMode[mode]}</span>
      </div>

      {mounted ? (
        <>
          <div className="-mx-1 overflow-hidden px-1 pb-1">
            <div ref={chartBoxRef} className="h-[275px] w-full sm:h-[330px]">
              {chartWidth > 20 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} barGap={3} barCategoryGap={mode === "month" ? "10%" : mode === "day" ? "18%" : "16%"} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                  <CartesianGrid vertical={false} strokeDasharray="4 5" stroke="#F4C7C4" />
                  <XAxis
                    dataKey="label"
                    stroke="#9B746B"
                    fontSize={mode === "month" ? 9 : 10}
                    height={xAxisHeight}
                    interval={0}
                    minTickGap={0}
                    ticks={xAxisTicks}
                    tickLine
                    tickMargin={8}
                    angle={xAxisAngle}
                    textAnchor={mode === "day" ? "middle" : "end"}
                  />
                  <YAxis stroke="#9B746B" fontSize={10} width={42} tickFormatter={(value) => formatCompactMoney(Number(value))} />
                  <Tooltip
                    cursor={{ fill: "rgba(234,113,136,0.08)" }}
                    formatter={(value) => formatMoney(Number(value))}
                    contentStyle={{ background: "#ffffff", border: "1px solid #F4C7C4", borderRadius: 16 }}
                  />
                  <Bar name="Chi" dataKey="expense" fill={chartColors.expense} radius={[10, 10, 0, 0]} maxBarSize={56} />
                  <Bar name="Lợi nhuận" dataKey="profit" fill={chartColors.profit} radius={[10, 10, 0, 0]} maxBarSize={56} />
                  <Bar name="Thu" dataKey="income" fill={chartColors.income} radius={[10, 10, 0, 0]} maxBarSize={56} />
                </BarChart>
              </ResponsiveContainer>
              ) : null}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap justify-center gap-3 text-xs font-black sm:gap-4 sm:text-sm">
            <LegendDot color="bg-red-500" label="Chi" />
            <LegendDot color="bg-violet-500" label="Lợi nhuận" />
            <LegendDot color="bg-emerald-500" label="Thu" />
          </div>
        </>
      ) : (
        <div className="h-60 rounded-2xl bg-[#FFF3EC] sm:h-[300px]" />
      )}
    </Card>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-[#5B342C]">
      <span className={`h-3 w-3 rounded-full sm:h-3.5 sm:w-3.5 ${color}`} />
      {label}
    </span>
  );
}
