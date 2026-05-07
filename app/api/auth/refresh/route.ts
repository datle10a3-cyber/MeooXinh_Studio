import { cookies } from "next/headers";
import { fail, ok, serverError } from "@/app/lib/api-response";
import {
  authCookieNames,
  buildSessionUser,
  createRefreshTokenValue,
  hashToken,
  persistRefreshToken,
  sessionDeviceFromRequest,
  setAuthCookies,
  signAccessToken,
} from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

export async function POST(req: Request) {
  try {
    const store = await cookies();
    const refreshToken = store.get(authCookieNames.refreshCookie)?.value;
    if (!refreshToken) return fail("Phiên đăng nhập đã hết hạn.", 401);

    const stored = await prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(refreshToken) },
    });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      return fail("Phiên đăng nhập không hợp lệ.", 401);
    }

    const sessionUser = await buildSessionUser(stored.userId);
    if (!sessionUser) return fail("Tài khoản không còn hiệu lực.", 401);

    const nextRefresh = createRefreshTokenValue();
    await prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });
    await persistRefreshToken(sessionUser.id, nextRefresh, sessionDeviceFromRequest(req));
    await setAuthCookies(await signAccessToken(sessionUser), nextRefresh);

    return ok({ user: sessionUser });
  } catch (error) {
    return serverError(error);
  }
}
