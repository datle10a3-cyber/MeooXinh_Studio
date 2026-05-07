import { fail, ok, serverError } from "@/app/lib/api-response";
import { authCookieNames, hashToken, requireUser } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { cookies } from "next/headers";

function cleanDeviceName(value: string | null | undefined) {
  return String(value ?? "")
    .replace(/Tr.+nh duy.+t/g, "Trình duyệt")
    .replace(/Thi.+t b.+/g, "Thiết bị")
    .replace(/.+ang d.+ng/g, "đang dùng")
    .trim();
}

function sessionGroupKey(session: { deviceName: string | null; deviceKey?: string | null; ipAddress: string | null; userAgent: string | null }) {
  if (session.deviceKey) return session.deviceKey;
  return [
    cleanDeviceName(session.deviceName),
    String(session.ipAddress ?? ""),
    String(session.userAgent ?? ""),
  ].join("|");
}

export async function GET() {
  try {
    const user = await requireUser();
    const store = await cookies();
    const current = store.get(authCookieNames.refreshCookie)?.value;
    const currentHash = current ? hashToken(current) : "";
    const sessions = await prisma.refreshToken.findMany({
      where: { userId: user.id, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: [{ lastUsedAt: "desc" }, { createdAt: "desc" }],
      select: { id: true, tokenHash: true, deviceName: true, deviceKey: true, ipAddress: true, userAgent: true, lastUsedAt: true, createdAt: true, expiresAt: true },
    });

    const groupedSessions = Array.from(sessions.reduce((map, session) => {
      const key = sessionGroupKey(session);
      const current = map.get(key);
      const isCurrent = session.tokenHash === currentHash;
      const ids = [...(current?.ids ?? []), session.id];
      const latestTime = session.lastUsedAt ?? session.createdAt;
      const currentLatest = current?.latestTime ?? new Date(0);
      map.set(key, {
        ...((!current || latestTime > currentLatest) ? session : current.session),
        session: (!current || latestTime > currentLatest) ? session : current.session,
        ids,
        isCurrent: Boolean(current?.isCurrent || isCurrent),
        latestTime: latestTime > currentLatest ? latestTime : currentLatest,
      });
      return map;
    }, new Map<string, { session: typeof sessions[number]; ids: string[]; isCurrent: boolean; latestTime: Date }>()).values());

    return ok(groupedSessions.map((group, index) => {
      const session = group.session;
      const deviceName = cleanDeviceName(session.deviceName) || `Thiết bị khác ${index + 1}`;
      return {
        id: group.ids.join(","),
        name: group.isCurrent ? `${deviceName} (đang dùng)` : deviceName,
        ipAddress: session.ipAddress,
        userAgent: session.userAgent,
        isCurrent: group.isCurrent,
        lastUsedAt: session.lastUsedAt,
        createdAt: session.createdAt,
        expiresAt: session.expiresAt,
      };
    }));
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") return fail("Chưa đăng nhập.", 401);
    return serverError(error);
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await requireUser();
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return fail("Thiếu mã phiên đăng nhập.", 422);
    const ids = id.split(",").map((item) => item.trim()).filter(Boolean);
    const store = await cookies();
    const current = store.get(authCookieNames.refreshCookie)?.value;
    const currentHash = current ? hashToken(current) : "";
    const targets = await prisma.refreshToken.findMany({ where: { id: { in: ids }, userId: user.id }, select: { id: true, tokenHash: true } });
    if (!targets.length) return fail("Không tìm thấy phiên đăng nhập.", 404);
    if (targets.some((target) => target.tokenHash === currentHash)) return fail("Không thể đá thiết bị đang dùng tại đây. Hãy dùng nút Đăng xuất.", 422);

    await prisma.refreshToken.updateMany({ where: { id: { in: targets.map((target) => target.id) } }, data: { revokedAt: new Date() } });
    return ok({ id });
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") return fail("Chưa đăng nhập.", 401);
    return serverError(error);
  }
}
