import { fail, ok, serverError } from "@/app/lib/api-response";
import { authCookieNames, hashToken, requireUser } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { cookies } from "next/headers";

export async function POST() {
  try {
    const session = await requireUser();
    const store = await cookies();
    const currentRefreshToken = store.get(authCookieNames.refreshCookie)?.value;
    const currentTokenHash = currentRefreshToken ? hashToken(currentRefreshToken) : "";
    const result = await prisma.refreshToken.updateMany({
      where: {
        userId: session.id,
        revokedAt: null,
        ...(currentTokenHash ? { tokenHash: { not: currentTokenHash } } : {}),
      },
      data: { revokedAt: new Date() },
    });

    return ok({ revoked: result.count });
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") return fail("Chưa đăng nhập.", 401);
    return serverError(error);
  }
}
