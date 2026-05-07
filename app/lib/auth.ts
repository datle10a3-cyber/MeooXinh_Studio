import { createHash, randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { jwtVerify, SignJWT } from "jose";
import { cookies, headers } from "next/headers";
import { prisma } from "@/app/lib/prisma";
import { clientIp } from "@/app/lib/security";

const accessCookie = "studio_access_token";
const refreshCookie = "studio_refresh_token";
const deviceCookie = "studio_device_id";
const encoder = new TextEncoder();

export type SessionUser = {
  id: string;
  studioId: string;
  role: "ADMIN" | "MANAGER" | "STAFF";
  name: string;
  email: string;
  phone?: string | null;
  avatarUrl?: string | null;
};

function jwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET_MISSING_OR_WEAK");
  }
  return encoder.encode(secret);
}

function isDevBypassHost(host: string | null) {
  if (process.env.AUTH_DEV_BYPASS !== "true" || process.env.NODE_ENV === "production") return false;
  const hostname = String(host ?? "").split(":")[0];
  return hostname === "127.0.0.1" || hostname === "localhost";
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function signAccessToken(user: SessionUser) {
  return new SignJWT(user)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(jwtSecret());
}

export async function verifyAccessToken(token: string) {
  const { payload } = await jwtVerify(token, jwtSecret());
  return payload as unknown as SessionUser;
}

export function createRefreshTokenValue() {
  return randomUUID() + "." + randomUUID();
}

function deviceNameFromUserAgent(userAgent: string) {
  const ua = userAgent.toLowerCase();
  const browser = ua.includes("edg/") ? "Edge" : ua.includes("chrome/") || ua.includes("crios/") ? "Chrome" : ua.includes("safari/") ? "Safari" : ua.includes("firefox/") ? "Firefox" : "Tr?nh duy?t";
  const os = ua.includes("iphone") ? "iPhone" : ua.includes("ipad") || (ua.includes("macintosh") && ua.includes("mobile")) ? "iPad" : ua.includes("android") ? "Android" : ua.includes("windows") ? "Windows" : ua.includes("mac os") ? "Mac" : "Thi?t b?";
  return `${os} - ${browser}`;
}

export function sessionDeviceFromRequest(req: Request) {
  const userAgent = req.headers.get("user-agent") ?? "";
  return {
    userAgent,
    ipAddress: clientIp(req),
    deviceName: deviceNameFromUserAgent(userAgent),
    lastUsedAt: new Date(),
  };
}

export async function setAuthCookies(accessToken: string, refreshToken: string) {
  const store = await cookies();
  const secure = process.env.NODE_ENV === "production";
  store.set(accessCookie, accessToken, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: 60 * 15,
  });
  store.set(refreshCookie, refreshToken, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

async function setAccessCookie(accessToken: string) {
  const store = await cookies();
  store.set(accessCookie, accessToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 15,
  });
}

export async function clearAuthCookies() {
  const store = await cookies();
  store.delete(accessCookie);
  store.delete(refreshCookie);
}

async function currentDeviceKey() {
  const store = await cookies();
  let deviceKey = store.get(deviceCookie)?.value;
  if (!deviceKey) {
    deviceKey = randomUUID();
    store.set(deviceCookie, deviceKey, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }
  return deviceKey;
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(accessCookie)?.value;
  const refreshToken = store.get(refreshCookie)?.value;

  if (token) {
    try {
      const user = await verifyAccessToken(token);
      if (!refreshToken) return null;
      const storedRefresh = await prisma.refreshToken.findUnique({
        where: { tokenHash: hashToken(refreshToken) },
        select: { userId: true, revokedAt: true, expiresAt: true },
      });
      if (!storedRefresh || storedRefresh.userId !== user.id || storedRefresh.revokedAt || storedRefresh.expiresAt < new Date()) {
        return null;
      }
      return user;
    } catch {
            // Trong dev LAN, n?u token c? ho?c l?i th? d?ng fallback b?n d??i.
    }
  }

  if (refreshToken) {
    const storedRefresh = await prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(refreshToken) },
      select: { userId: true, revokedAt: true, expiresAt: true },
    });
    if (storedRefresh && !storedRefresh.revokedAt && storedRefresh.expiresAt >= new Date()) {
      const sessionUser = await buildSessionUser(storedRefresh.userId);
      if (sessionUser) {
        await setAccessCookie(await signAccessToken(sessionUser));
        return sessionUser;
      }
    }
  }

  const headerStore = await headers();
  if (!token && isDevBypassHost(headerStore.get("host"))) {
    const user = await prisma.user.findFirst({
      where: { status: "ACTIVE" },
      orderBy: { createdAt: "asc" },
      include: { role: true },
    });

    if (user) {
      return {
        id: user.id,
        studioId: user.studioId,
        role: (user.role?.name ?? "ADMIN") as SessionUser["role"],
        name: user.name,
        email: user.email,
        phone: user.phone,
        avatarUrl: user.avatarUrl,
      };
    }
  }

  return null;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("UNAUTHORIZED");
  return user;
}

export function canWrite(role: SessionUser["role"]) {
  return role === "ADMIN" || role === "MANAGER" || role === "STAFF";
}

export function canCreate(role: SessionUser["role"]) {
  return role === "ADMIN" || role === "MANAGER";
}

export function canUpdate(role: SessionUser["role"]) {
  return role === "ADMIN" || role === "MANAGER" || role === "STAFF";
}

export async function verifyStudioEditPassword(user: SessionUser, password: unknown) {
  if (user.role !== "STAFF") return true;
  const value = String(password ?? "").trim();
  if (!/^\d{6}$/.test(value)) return false;
  const studio = await prisma.studio.findUnique({
    where: { id: user.studioId },
    select: { shiftPasswordHash: true },
  });
  if (studio?.shiftPasswordHash) return verifyPassword(value, studio.shiftPasswordHash);
  return process.env.NODE_ENV !== "production" && value === "000000";
}

export async function persistRefreshToken(userId: string, refreshToken: string, device?: ReturnType<typeof sessionDeviceFromRequest>) {
  const deviceKey = await currentDeviceKey();
  await prisma.refreshToken.updateMany({
    where: {
      userId,
      deviceKey,
      revokedAt: null,
    },
    data: { revokedAt: new Date() },
  });

  return prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: hashToken(refreshToken),
      userAgent: device?.userAgent,
      ipAddress: device?.ipAddress,
      deviceName: device?.deviceName,
      deviceKey,
      lastUsedAt: device?.lastUsedAt ?? new Date(),
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
    },
  });
}

export async function buildSessionUser(userId: string): Promise<SessionUser | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { role: true },
  });

  if (!user || user.status !== "ACTIVE") return null;

  return {
    id: user.id,
    studioId: user.studioId,
    role: (user.role?.name ?? "STAFF") as SessionUser["role"],
    name: user.name,
    email: user.email,
    phone: user.phone,
    avatarUrl: user.avatarUrl,
  };
}

export const authCookieNames = { accessCookie, refreshCookie, deviceCookie };
