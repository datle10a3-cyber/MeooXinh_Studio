import { NextResponse } from "next/server";

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ data }, init);
}

export function created<T>(data: T) {
  return ok(data, { status: 201 });
}

export function fail(message: string, status = 400, details?: unknown) {
  return NextResponse.json({ error: { message, details } }, { status });
}

export function serverError(error: unknown) {
  console.error(error);
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (message.includes("Can't reach database server") || message.includes("P1001")) {
    return fail("Database chưa chạy. Hãy chạy npm run db:up rồi mở lại web.", 503);
  }

  const detailMsg = error instanceof Error ? `${error.message}\n${error.stack ?? ""}` : String(error);
  return fail(`Máy chủ đang gặp lỗi: ${detailMsg}`, 500);
}

// Trigger Vercel redeployment in Singapore region (sin1) to minimize database latency


