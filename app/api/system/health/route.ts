export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = {
  "Cache-Control": "no-store",
};

export async function HEAD() {
  return new Response(null, {
    status: 200,
    headers,
  });
}

export async function GET() {
  return Response.json(
    {
      ok: true,
      status: "healthy",
      service: "meoo-xinh-studio",
      timestamp: new Date().toISOString(),
    },
    {
      status: 200,
      headers,
    },
  );
}
