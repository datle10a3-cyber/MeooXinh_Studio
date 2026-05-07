type RateLimitEntry = {
  count: number;
  resetAt: number;
  blockedUntil?: number;
};

const buckets = new Map<string, RateLimitEntry>();

export function clientIp(req: Request) {
  const forwardedFor = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwardedFor || req.headers.get("x-real-ip") || req.headers.get("cf-connecting-ip") || "unknown";
}

export function rateLimit(
  key: string,
  options: { limit: number; windowMs: number; blockMs?: number },
) {
  const now = Date.now();
  const current = buckets.get(key);

  if (current?.blockedUntil && current.blockedUntil > now) {
    return { allowed: false, retryAfter: Math.ceil((current.blockedUntil - now) / 1000) };
  }

  const entry = current && current.resetAt > now
    ? current
    : { count: 0, resetAt: now + options.windowMs };

  entry.count += 1;
  if (entry.count > options.limit) {
    entry.blockedUntil = now + (options.blockMs ?? options.windowMs);
    buckets.set(key, entry);
    return { allowed: false, retryAfter: Math.ceil((entry.blockedUntil - now) / 1000) };
  }

  buckets.set(key, entry);
  return { allowed: true, retryAfter: 0 };
}

export function strongPasswordMessage(password: string) {
  if (password.length < 10) return "Mật khẩu cần ít nhất 10 ký tự.";
  if (!/[a-z]/.test(password)) return "Mật khẩu cần có chữ thường.";
  if (!/[A-Z]/.test(password)) return "Mật khẩu cần có chữ hoa.";
  if (!/\d/.test(password)) return "Mật khẩu cần có số.";
  return "";
}
