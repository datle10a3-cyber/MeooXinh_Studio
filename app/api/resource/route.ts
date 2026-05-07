import { fail } from "@/app/lib/api-response";

export function GET() {
  return fail("Hãy dùng endpoint /api/resources/[resource].", 404);
}
