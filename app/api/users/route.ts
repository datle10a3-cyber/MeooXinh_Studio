import { created, fail, ok, serverError } from "@/app/lib/api-response";
import { writeAuditLog } from "@/app/lib/audit";
import { hashPassword, requireUser } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

const allowedRoles = new Set(["ADMIN", "MANAGER", "STAFF"]);

function clean(value: unknown) {
  const text = String(value ?? "").trim();
  return text ? text : null;
}

function normalizeMoney(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function normalizeRole(value: unknown) {
  const role = String(value ?? "STAFF").toUpperCase();
  return allowedRoles.has(role) ? role : null;
}

function normalizeGallery(value: unknown) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(String(value));
    if (!Array.isArray(parsed)) return null;
    return JSON.stringify(parsed.filter((item) => typeof item === "string" && item.trim()).slice(0, 4));
  } catch {
    return null;
  }
}

function roleDescription(roleName: string) {
  if (roleName === "ADMIN") return "Toàn quyền quản trị studio.";
  if (roleName === "MANAGER") return "Quản lý vận hành, được thêm và sửa dữ liệu.";
  return "Nhân viên thao tác nghiệp vụ, không xem doanh thu, không xóa, không xuất CSV.";
}

function toRow(employee: Awaited<ReturnType<typeof prisma.employee.findMany>>[number], account?: { id: string; email: string; role?: { name: string } | null; status: string } | null) {
  return {
    id: employee.id,
    userId: employee.userId,
    name: employee.name,
    phone: employee.phone,
    email: employee.email,
    position: employee.position,
    address: employee.address,
    salaryType: employee.salaryType,
    baseSalary: employee.baseSalary,
    workSchedule: employee.workSchedule,
    note: employee.note,
    avatarUrl: employee.avatarUrl,
    galleryUrls: employee.galleryUrls,
    accountEmail: account?.email ?? employee.email,
    role: account?.role?.name ?? "STAFF",
    status: account?.status ?? "NO_ACCOUNT",
    createdAt: employee.createdAt,
  };
}

export async function GET() {
  try {
    const user = await requireUser();
    if (user.role !== "ADMIN") return fail("Chỉ admin được xem nhân sự và tài khoản.", 403);

    const employees = await prisma.employee.findMany({
      where: { studioId: user.studioId, deletedAt: null },
      orderBy: { createdAt: "desc" },
    });
    const userIds = employees.map((row) => row.userId).filter(Boolean) as string[];
    const accounts = userIds.length
      ? await prisma.user.findMany({ where: { id: { in: userIds }, studioId: user.studioId }, include: { role: true } })
      : [];
    const accountMap = new Map(accounts.map((account) => [account.id, account]));

    return ok(employees.map((employee) => toRow(employee, employee.userId ? accountMap.get(employee.userId) : null)));
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") return fail("Chưa đăng nhập.", 401);
    return serverError(error);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    if (user.role !== "ADMIN") return fail("Chỉ admin được tạo nhân viên.", 403);

    const body = await req.json();
    const name = clean(body.name);
    const email = clean(body.email)?.toLowerCase() ?? null;
    const password = String(body.password ?? "");
    const roleName = normalizeRole(body.role);
    const shouldCreateAccount = Boolean(body.createAccount);

    if (!name) return fail("Vui lòng nhập tên nhân viên.", 422);
    if (!roleName) return fail("Vai trò không hợp lệ.", 422);
    if (shouldCreateAccount && !email?.includes("@")) return fail("Email đăng nhập không hợp lệ.", 422);
    if (shouldCreateAccount && password.length < 8) return fail("Mật khẩu cần ít nhất 8 ký tự.", 422);
    if (shouldCreateAccount && email) {
      const existed = await prisma.user.findUnique({ where: { email } });
      if (existed) return fail("Email này đã có tài khoản.", 409);
    }

    const row = await prisma.$transaction(async (tx) => {
      let createdUser: { id: string } | null = null;
      if (shouldCreateAccount && email) {
        const role = await tx.role.upsert({
          where: { studioId_name: { studioId: user.studioId, name: roleName } },
          update: {},
          create: { studioId: user.studioId, name: roleName, description: roleDescription(roleName) },
        });
        createdUser = await tx.user.create({
          data: {
            studioId: user.studioId,
            roleId: role.id,
            name,
            email,
            phone: clean(body.phone),
            passwordHash: await hashPassword(password),
            status: String(body.status ?? "ACTIVE"),
          },
        });
      }

      return tx.employee.create({
        data: {
          studioId: user.studioId,
          userId: createdUser?.id ?? null,
          name,
          phone: clean(body.phone),
          email,
          position: clean(body.position) ?? (roleName === "MANAGER" ? "Quản lý" : "Nhân viên"),
          address: clean(body.address),
          salaryType: clean(body.salaryType) ?? "FIXED",
          baseSalary: normalizeMoney(body.baseSalary),
          workSchedule: clean(body.workSchedule),
          note: clean(body.note),
          avatarUrl: clean(body.avatarUrl),
          galleryUrls: normalizeGallery(body.galleryUrls),
        },
      });
    });

    await writeAuditLog(user, "CREATE", "Employee", row.id, { name: row.name });
    return created(toRow(row, null));
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") return fail("Chưa đăng nhập.", 401);
    return serverError(error);
  }
}

export async function PUT(req: Request) {
  try {
    const user = await requireUser();
    if (user.role !== "ADMIN") return fail("Chỉ admin được cập nhật nhân viên.", 403);

    const body = await req.json();
    const id = String(body.id ?? "");
    const roleName = normalizeRole(body.role);
    const name = clean(body.name);
    const email = clean(body.email)?.toLowerCase() ?? null;
    const password = String(body.password ?? "");
    const shouldCreateAccount = Boolean(body.createAccount);

    if (!id) return fail("Thiếu mã nhân viên.", 422);
    if (!name) return fail("Vui lòng nhập tên nhân viên.", 422);
    if (!roleName) return fail("Vai trò không hợp lệ.", 422);

    const current = await prisma.employee.findFirst({ where: { id, studioId: user.studioId, deletedAt: null } });
    if (!current) return fail("Không tìm thấy nhân viên.", 404);

    const row = await prisma.$transaction(async (tx) => {
      let userId = current.userId;
      if (userId) {
        const role = await tx.role.upsert({
          where: { studioId_name: { studioId: user.studioId, name: roleName } },
          update: {},
          create: { studioId: user.studioId, name: roleName, description: roleDescription(roleName) },
        });
        const data: Record<string, unknown> = {
          roleId: role.id,
          name,
          phone: clean(body.phone),
          status: String(body.status ?? "ACTIVE"),
        };
        if (email?.includes("@")) data.email = email;
        if (password.length >= 8) data.passwordHash = await hashPassword(password);
        await tx.user.update({ where: { id: userId }, data });
      } else if (shouldCreateAccount) {
        if (!email?.includes("@")) throw new Error("INVALID_EMAIL");
        if (password.length < 8) throw new Error("WEAK_PASSWORD");
        const existed = await tx.user.findUnique({ where: { email } });
        if (existed) throw new Error("EMAIL_EXISTS");
        const role = await tx.role.upsert({
          where: { studioId_name: { studioId: user.studioId, name: roleName } },
          update: {},
          create: { studioId: user.studioId, name: roleName, description: roleDescription(roleName) },
        });
        const createdUser = await tx.user.create({
          data: {
            studioId: user.studioId,
            roleId: role.id,
            name,
            email,
            phone: clean(body.phone),
            passwordHash: await hashPassword(password),
            status: String(body.status ?? "ACTIVE"),
          },
        });
        userId = createdUser.id;
      }

      return tx.employee.update({
        where: { id },
        data: {
          userId,
          name,
          phone: clean(body.phone),
          email,
          position: clean(body.position) ?? "Nhân viên",
          address: clean(body.address),
          salaryType: clean(body.salaryType) ?? "FIXED",
          baseSalary: normalizeMoney(body.baseSalary),
          workSchedule: clean(body.workSchedule),
          note: clean(body.note),
          avatarUrl: clean(body.avatarUrl),
          galleryUrls: normalizeGallery(body.galleryUrls),
        },
      });
    });

    const account = row.userId ? await prisma.user.findFirst({ where: { id: row.userId, studioId: user.studioId }, include: { role: true } }) : null;
    await writeAuditLog(user, "UPDATE", "Employee", row.id, { name: row.name });
    return ok(toRow(row, account));
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") return fail("Chưa đăng nhập.", 401);
    if ((error as Error).message === "INVALID_EMAIL") return fail("Email đăng nhập không hợp lệ.", 422);
    if ((error as Error).message === "WEAK_PASSWORD") return fail("Mật khẩu cần ít nhất 8 ký tự.", 422);
    if ((error as Error).message === "EMAIL_EXISTS") return fail("Email này đã có tài khoản.", 409);
    return serverError(error);
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await requireUser();
    if (user.role !== "ADMIN") return fail("Chỉ admin được xóa nhân viên.", 403);
    const { id, mode } = await req.json();
    if (!id) return fail("Thiếu mã nhân viên.", 422);

    const employee = await prisma.employee.findFirst({ where: { id, studioId: user.studioId, deletedAt: null } });
    if (!employee) return fail("Không tìm thấy nhân viên.", 404);

    await prisma.$transaction(async (tx) => {
      if (mode === "hard") {
        await tx.workLog.deleteMany({ where: { employeeId: id } });
        await tx.employee.delete({ where: { id } });
        if (employee.userId) {
          await tx.notification.updateMany({ where: { userId: employee.userId }, data: { userId: null } });
          await tx.auditLog.updateMany({ where: { userId: employee.userId }, data: { userId: null } });
          await tx.refreshToken.deleteMany({ where: { userId: employee.userId } });
          await tx.user.delete({ where: { id: employee.userId } });
        }
        return;
      }

      await tx.employee.update({ where: { id }, data: { deletedAt: new Date() } });
      if (employee.userId) {
        await tx.user.update({ where: { id: employee.userId }, data: { status: "INACTIVE" } });
      }
    });

    await writeAuditLog(user, mode === "hard" ? "DELETE" : "TRASH", "Employee", String(id), { name: employee.name });
    return ok({ id });
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") return fail("Chưa đăng nhập.", 401);
    return serverError(error);
  }
}
