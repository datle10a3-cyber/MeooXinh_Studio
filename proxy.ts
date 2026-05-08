import { NextResponse, type NextRequest } from "next/server";

const protectedPrefixes = [
  "/api/auth/me",
  "/api/auth/logout",
  "/api/backup",
  "/api/search",
  "/api/resources",
  "/api/resource",
  "/api/dashboard",
  "/api/reports",
  "/api/system",
  "/api/media",
  "/api/ai",
  "/api/categories",
  "/api/packages",
  "/api/bookings",
  "/api/users",
  "/api/profile",
  "/api/push",
  "/api/notifications",
  "/api/wallet-shifts",
  "/api/activity",
];

function isDevBypassHost(host: string | null) {
  if (process.env.AUTH_DEV_BYPASS !== "true" || process.env.NODE_ENV === "production") return false;
  const hostname = String(host ?? "").split(":")[0];
  return hostname === "127.0.0.1" || hostname === "localhost";
}

function securityHeaders(response: NextResponse) {
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  // Relaxed for mobile compatibility (Safari/Webviews)
  // response.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  // response.headers.set("Cross-Origin-Resource-Policy", "same-origin");
  if (process.env.NODE_ENV === "production") {
    response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  }
  return response;
}

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const needsAuth = protectedPrefixes.some((prefix) => pathname.startsWith(prefix));
  if (!needsAuth) return securityHeaders(NextResponse.next());

  if (isDevBypassHost(request.headers.get("host"))) {
    return securityHeaders(NextResponse.next());
  }

  const hasAuthCookie = request.cookies.has("studio_access_token") || request.cookies.has("studio_refresh_token");
  if (!hasAuthCookie) {
    return securityHeaders(NextResponse.json({ error: { message: "Chưa đăng nhập." } }, { status: 401 }));
  }

  return securityHeaders(NextResponse.next());
}

export const config = {
  matcher: ["/api/(.*)"],
};
