import { fail, ok, serverError } from "@/app/lib/api-response";
import { buildSessionUser, isRootAdmin, requireUser, rootAdminIdentity, setAccessCookie, signAccessToken, type SessionUser } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { isRootAdminEmail } from "@/app/utils/root-admin";

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    if (!isRootAdmin(user)) return fail("Chỉ Super Admin được vào xem studio admin khác.", 403);

    const body = await req.json().catch(() => ({}));
    const targetId = String(body.id ?? "");
    if (!targetId) return fail("Thiếu mã admin.", 422);

    const target = await prisma.user.findUnique({
      where: { id: targetId },
      include: { role: true, studio: true },
    });
    if (!target || target.role?.name !== "ADMIN") return fail("Không tìm thấy admin cần xem.", 404);
    if (isRootAdminEmail(target.email)) return fail("Bạn đang là Super Admin rồi.", 422);

    const rootIdentity = rootAdminIdentity(user);
    if (!rootIdentity.rootAdminId || !rootIdentity.rootAdminEmail) return fail("Không xác định được Super Admin.", 403);

    const targetSession: SessionUser = {
      id: target.id,
      studioId: target.studioId,
      role: "ADMIN",
      name: target.name,
      email: target.email,
      phone: target.phone,
      avatarUrl: target.avatarUrl,
    };
    const impersonatedSession = {
      ...targetSession,
      ...rootIdentity,
      impersonatingAdminId: target.id,
      impersonatingAdminEmail: target.email,
    };
    await setAccessCookie(await signAccessToken(impersonatedSession));

    return ok({ user: impersonatedSession, studio: target.studio });
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") return fail("Bạn chưa đăng nhập.", 401);
    return serverError(error);
  }
}

export async function DELETE() {
  try {
    const user = await requireUser();
    const rootId = user.rootAdminId;
    if (!rootId || !isRootAdmin(user)) return fail("Bạn không đang xem hộ admin nào.", 422);

    const rootSession = await buildSessionUser(rootId);
    if (!rootSession || !isRootAdminEmail(rootSession.email)) return fail("Không tìm thấy Super Admin.", 404);
    const studio = await prisma.studio.findUnique({
      where: { id: rootSession.studioId },
      select: { id: true, name: true, slug: true, currency: true, email: true, phone: true, address: true },
    });
    await setAccessCookie(await signAccessToken(rootSession));

    return ok({ user: rootSession, studio });
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") return fail("Bạn chưa đăng nhập.", 401);
    return serverError(error);
  }
}
