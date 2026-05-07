import { fail, ok, serverError } from "@/app/lib/api-response";
import { requireUser } from "@/app/lib/auth";
import { uploadMediaFile } from "@/app/lib/media-service";
import { prisma } from "@/app/lib/prisma";

const maxAvatarSize = 2 * 1024 * 1024;

export async function POST(req: Request) {
  try {
    const session = await requireUser();
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return fail("Vui lòng chọn ảnh đại diện.", 422);
    if (!file.type.startsWith("image/")) return fail("File phải là ảnh.", 422);
    if (file.size > maxAvatarSize) return fail("Ảnh đại diện tối đa 2MB.", 422);

    const uploaded = await uploadMediaFile(file);
    const user = await prisma.user.update({
      where: { id: session.id },
      data: { avatarUrl: uploaded.url },
      include: { role: true },
    });

    return ok({
      avatarUrl: user.avatarUrl,
      user: {
        id: user.id,
        studioId: user.studioId,
        role: user.role?.name ?? "STAFF",
        name: user.name,
        email: user.email,
        phone: user.phone,
        avatarUrl: user.avatarUrl,
      },
    });
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") return fail("Chưa đăng nhập.", 401);
    return serverError(error);
  }
}
