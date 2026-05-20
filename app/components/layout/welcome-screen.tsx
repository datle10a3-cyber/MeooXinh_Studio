"use client";

import Link from "next/link";
import { ArrowRight, BadgeDollarSign, CalendarCheck, Sparkles, Users } from "lucide-react";
import { Card, CardTitle } from "@/app/components/ui/card";
import { STUDIO_AVATAR_URL, STUDIO_DISPLAY_NAME } from "@/app/components/brand/studio-brand";

const features = [
  { title: "Tài chính rõ ràng", text: "Theo dõi thu, chi, ví tiền, hóa đơn và công nợ.", icon: BadgeDollarSign },
  { title: "Booking dễ kiểm soát", text: "Quản lý lịch chụp, phòng, tiền cọc và tránh trùng giờ.", icon: CalendarCheck },
  { title: "CRM cho studio", text: "Lưu khách hàng, nguồn khách, ghi chú chăm sóc và lịch sử mua.", icon: Users },
  { title: "Trợ lý AI", text: "Gợi ý việc cần làm, cảnh báo rủi ro và dự báo doanh thu.", icon: Sparkles },
];

export function WelcomeScreen() {
  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[2.5rem] border-4 border-[#F7AFC0] bg-[#FFF9EF] p-6 shadow-[0_24px_80px_rgba(181,91,102,0.22)] md:p-10">
        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.18em] text-[#E88498]">{STUDIO_DISPLAY_NAME} make & photo</p>
            <h1 className="mt-3 max-w-3xl text-4xl font-black tracking-tight text-[#EA7188] md:text-6xl">
              Quản lý studio mềm mại hơn, rõ việc hơn.
            </h1>
            <p className="mt-4 max-w-2xl text-base font-semibold leading-7 text-[#8C655E]">
              Booking, khách hàng, dự án, hóa đơn, thu chi, nhân sự, thiết bị và AI trong cùng một hệ thống.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/login" className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-[#EA7188] px-5 text-sm font-bold text-white shadow-sm transition hover:bg-[#DA5E79] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EA7188]/35">
                Đăng nhập
                <ArrowRight size={17} />
              </Link>
              <Link href="/register" className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-[#F4C7C4] bg-white px-5 text-sm font-bold text-[#5B342C] shadow-sm transition hover:bg-[#FFF0F4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EA7188]/35">
                Tạo studio mới
              </Link>
            </div>
          </div>
          <div className="rounded-[2rem] border border-[#F4C7C4] bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="grid h-16 w-16 place-items-center overflow-hidden rounded-full bg-[#FFE4EA] text-4xl">
                <img src={STUDIO_AVATAR_URL} alt={STUDIO_DISPLAY_NAME} className="h-full w-full rounded-full object-cover" />
              </div>
              <div>
                <p className="font-black text-[#5B342C]">{STUDIO_DISPLAY_NAME}</p>
                <p className="text-sm font-semibold text-[#9B746B]">Làm đẹp và lưu giữ thanh xuân</p>
              </div>
            </div>
            <div className="mt-6 space-y-3">
              <div className="rounded-[1.3rem] bg-[#FFF3EC] p-4">
                <p className="text-sm font-bold text-[#9B746B]">Doanh thu tháng này</p>
                <p className="mt-1 text-2xl font-black text-[#EA7188]">73.000.000 đ</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-[1.3rem] bg-[#FFF3EC] p-4">
                  <p className="text-xs font-bold text-[#9B746B]">Booking</p>
                  <p className="mt-1 text-xl font-black text-[#5B342C]">18</p>
                </div>
                <div className="rounded-[1.3rem] bg-[#FFF3EC] p-4">
                  <p className="text-xs font-bold text-[#9B746B]">Công nợ</p>
                  <p className="mt-1 text-xl font-black text-[#EA7188]">28tr</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {features.map((feature) => {
          const Icon = feature.icon;
          return (
            <Card key={feature.title}>
              <Icon className="text-[#EA7188]" size={22} />
              <CardTitle className="mt-4">{feature.title}</CardTitle>
              <p className="mt-2 text-sm font-semibold leading-6 text-[#9B746B]">{feature.text}</p>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
