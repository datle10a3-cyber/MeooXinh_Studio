"use client";

import { CalendarDays } from "lucide-react";
import { Card, CardTitle } from "@/app/components/ui/card";
import { viOption } from "@/app/lib/vietnamese-labels";
import { formatDate } from "@/app/utils/format";
import { cn } from "@/app/utils/cn";

type BookingRow = Record<string, unknown>;

const statusColor: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  CONFIRMED: "bg-emerald-100 text-[#8C655E]",
  IN_PROGRESS: "bg-blue-100 text-blue-800",
  COMPLETED: "bg-slate-100 text-slate-700",
  CANCELLED: "bg-rose-100 text-rose-700",
};

function startOfWeek(date = new Date()) {
  const next = new Date(date);
  const day = next.getDay() || 7;
  next.setDate(next.getDate() - day + 1);
  next.setHours(0, 0, 0, 0);
  return next;
}

function sameDay(a?: unknown, b?: Date) {
  if (!a || !b) return false;
  const date = new Date(String(a));
  return date.getFullYear() === b.getFullYear() && date.getMonth() === b.getMonth() && date.getDate() === b.getDate();
}

export function BookingCalendar({
  bookings,
  onMove,
}: {
  bookings: BookingRow[];
  onMove: (booking: BookingRow, targetDate: Date) => void;
}) {
  const weekStart = startOfWeek();
  const days = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(weekStart);
    day.setDate(day.getDate() + index);
    return day;
  });

  return (
    <Card>
      <div className="mb-4 flex items-center gap-2">
        <CalendarDays className="text-[#A84E61]" size={19} />
        <CardTitle>Lịch tuần này</CardTitle>
      </div>
      <div className="grid gap-3 lg:grid-cols-7">
        {days.map((day) => {
          const rows = bookings.filter((booking) => sameDay(booking.startAt, day));
          return (
            <div
              key={day.toISOString()}
              className="min-h-40 rounded-lg border border-slate-200 bg-slate-50 p-2"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                const id = event.dataTransfer.getData("booking-id");
                const booking = bookings.find((item) => item.id === id);
                if (booking) onMove(booking, day);
              }}
            >
              <p className="mb-2 text-xs font-semibold uppercase text-slate-400">
                {day.toLocaleDateString("vi-VN", { weekday: "short", day: "2-digit", month: "2-digit" })}
              </p>
              <div className="space-y-2">
                {rows.map((booking) => (
                  <div
                    key={String(booking.id)}
                    draggable
                    onDragStart={(event) => event.dataTransfer.setData("booking-id", String(booking.id))}
                    className="cursor-grab rounded-md bg-white p-2 text-xs shadow-sm ring-1 ring-slate-200 active:cursor-grabbing"
                  >
                    <p className="font-semibold text-slate-950">{String(booking.title ?? "Booking")}</p>
                    <p className="mt-1 text-slate-500">{formatDate(booking.startAt as string | Date)}</p>
                    <span className={cn("mt-2 inline-flex rounded-full px-2 py-0.5 font-semibold", statusColor[String(booking.status)] ?? statusColor.PENDING)}>
                      {viOption(booking.status)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}



