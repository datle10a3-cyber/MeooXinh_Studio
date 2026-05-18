import { fail, ok } from "@/app/lib/api-response";
import { buildSessionUser, getCurrentUser } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return fail("Chưa đăng nhập.", 401);

  const [freshUser, studio] = await Promise.all([
    buildSessionUser(user.id),
    prisma.studio.findUnique({
      where: { id: user.studioId },
      select: { id: true, name: true, slug: true, currency: true, email: true, phone: true, address: true },
    }),
  ]);

  return ok({
    user: {
      ...(freshUser ?? user),
      rootAdminId: user.rootAdminId,
      rootAdminEmail: user.rootAdminEmail,
      impersonatingAdminId: user.impersonatingAdminId,
      impersonatingAdminEmail: user.impersonatingAdminEmail,
    },
    studio,
  });
}
