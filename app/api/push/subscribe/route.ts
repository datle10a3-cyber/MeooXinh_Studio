import { fail, ok, serverError } from "@/app/lib/api-response";
import { requireUser } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

export async function GET() {
  return ok({ publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "" });
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const endpoint = String(body.endpoint ?? "");
    const p256dh = String(body.keys?.p256dh ?? "");
    const auth = String(body.keys?.auth ?? "");
    if (!endpoint || !p256dh || !auth) return fail("Thiếu dữ liệu thiết bị nhận thông báo.", 422);

    await prisma.pushSubscription.upsert({
      where: { endpoint },
      create: {
        studioId: user.studioId,
        userId: user.id,
        endpoint,
        p256dh,
        auth,
        userAgent: req.headers.get("user-agent"),
      },
      update: {
        studioId: user.studioId,
        userId: user.id,
        p256dh,
        auth,
        userAgent: req.headers.get("user-agent"),
      },
    });

    return ok({ enabled: true });
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") return fail("Chưa đăng nhập.", 401);
    return serverError(error);
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json().catch(() => ({}));
    const endpoint = String(body.endpoint ?? "");
    if (!endpoint) return fail("Thiếu thiết bị cần tắt thông báo.", 422);

    await prisma.pushSubscription.deleteMany({
      where: {
        endpoint,
        userId: user.id,
        studioId: user.studioId,
      },
    });

    return ok({ enabled: false });
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") return fail("Chưa đăng nhập.", 401);
    return serverError(error);
  }
}
