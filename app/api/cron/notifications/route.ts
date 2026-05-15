import { fail, ok, serverError } from "@/app/lib/api-response";
import { generateAllStudioNotifications } from "@/app/lib/notification-service";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = req.headers.get("authorization");
    if (process.env.NODE_ENV === "production" && !cronSecret) {
      return fail("Missing CRON_SECRET.", 500);
    }
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return fail("Unauthorized cron request.", 401);
    }

    const result = await generateAllStudioNotifications();
    return ok(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return serverError(error);
  }
}
