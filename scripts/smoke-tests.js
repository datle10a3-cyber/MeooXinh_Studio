const baseUrl = process.env.SMOKE_BASE_URL || "http://localhost:3000";
const email = process.env.SMOKE_EMAIL;
const password = process.env.SMOKE_PASSWORD;
const writeMode = process.env.SMOKE_WRITE === "1";

if (!email || !password) {
  console.error("Thieu SMOKE_EMAIL hoac SMOKE_PASSWORD. Vi du: $env:SMOKE_EMAIL='admin@email.com'; $env:SMOKE_PASSWORD='...'; npm run test:smoke");
  process.exit(1);
}

let cookie = "";

function rememberCookies(response) {
  const setCookie = response.headers.getSetCookie ? response.headers.getSetCookie() : [];
  const fallback = response.headers.get("set-cookie");
  const values = setCookie.length ? setCookie : fallback ? [fallback] : [];
  if (!values.length) return;
  const next = new Map(cookie.split("; ").filter(Boolean).map((item) => {
    const [key, ...rest] = item.split("=");
    return [key, rest.join("=")];
  }));
  for (const raw of values) {
    const first = raw.split(";")[0];
    const [key, ...rest] = first.split("=");
    if (key) next.set(key, rest.join("="));
  }
  cookie = Array.from(next.entries()).map(([key, value]) => `${key}=${value}`).join("; ");
}

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
      ...(options.headers || {}),
    },
  });
  rememberCookies(response);
  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await response.json() : await response.text();
  if (!response.ok) {
    const message = typeof data === "object" ? data?.error?.message || JSON.stringify(data) : data;
    throw new Error(`${options.method || "GET"} ${path} -> ${response.status}: ${message}`);
  }
  return data;
}

async function main() {
  console.log(`Smoke test: ${baseUrl}`);
  await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  console.log("OK dang nhap");

  await request("/api/auth/me");
  await request("/api/system/health");
  await request("/api/categories?cursorMode=1&take=5");
  await request("/api/packages?cursorMode=1&take=5");
  await request("/api/bookings?cursorMode=1&take=5");
  await request("/api/resources/transactions?cursorMode=1&take=5");
  await request("/api/media?cursorMode=1&take=5");
  console.log("OK doc du lieu chinh va phan trang");

  const backup = await request("/api/backup?from=2100-01-01&to=2100-01-02");
  if (typeof backup !== "object" || !backup.version) throw new Error("Backup JSON khong dung dinh dang.");
  console.log("OK backup JSON");

  if (!writeMode) {
    console.log("Bo qua test tao/sua du lieu vi SMOKE_WRITE khac 1.");
    return;
  }

  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 12);
  const category = await request("/api/categories", {
    method: "POST",
    body: JSON.stringify({ name: `SMOKE ${stamp}`, description: "Du lieu kiem thu tu dong" }),
  });
  const pack = await request("/api/packages", {
    method: "POST",
    body: JSON.stringify({ categoryId: category.data.id, name: `SMOKE Goi ${stamp}`, price: 1000 }),
  });
  console.log("OK tao danh muc va goi");

  const start = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  await request("/api/bookings", {
    method: "POST",
    body: JSON.stringify({
      bookingMode: "GROUP",
      groupLabel: `SMOKE Nhom ${stamp}`,
      customerName: `SMOKE Khach A ${stamp}`,
      packageId: pack.data.id,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      status: "PENDING",
    }),
  });
  await request("/api/bookings", {
    method: "POST",
    body: JSON.stringify({
      bookingMode: "GROUP",
      groupLabel: `SMOKE Nhom ${stamp}`,
      customerName: `SMOKE Khach B ${stamp}`,
      packageId: pack.data.id,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      status: "PENDING",
    }),
  });
  console.log("OK tao booking nhom");

  const wallets = await request("/api/resources/wallets?take=1");
  const wallet = Array.isArray(wallets.data) ? wallets.data[0] : null;
  if (wallet) {
    const open = await request("/api/wallet-shifts", {
      method: "POST",
      body: JSON.stringify({ walletId: wallet.id, openingBalance: wallet.openingBalance || 0, note: `SMOKE ${stamp}` }),
    }).catch((error) => {
      if (String(error.message).includes("đang có ca mở") || String(error.message).includes("dang co ca mo")) return null;
      throw error;
    });
    await request("/api/resources/transactions", {
      method: "POST",
      body: JSON.stringify({ walletId: wallet.id, type: "INCOME", title: `SMOKE thu ${stamp}`, amount: 1000, occurredAt: new Date().toISOString() }),
    });
    if (open?.data?.id) {
      await request("/api/wallet-shifts", {
        method: "PATCH",
        body: JSON.stringify({ shiftId: open.data.id, actualClosingBalance: Number(open.data.openingBalance || 0) + 1000, closeNote: `SMOKE ${stamp}` }),
      });
    }
    console.log("OK thu chi va dong/mo ca");
  } else {
    console.log("Khong co vi, bo qua test thu chi va ca.");
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
