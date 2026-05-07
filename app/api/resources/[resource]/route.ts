import {
  createResource,
  deleteResource,
  getResource,
  updateResource,
  restoreResource,
} from "@/app/lib/resource-route-handlers";

type ResourceContext = { params: Promise<{ resource: string }> };

export async function GET(req: Request, ctx: ResourceContext) {
  const { resource } = await ctx.params;
  return getResource(req, resource);
}

export async function POST(req: Request, ctx: ResourceContext) {
  const { resource } = await ctx.params;
  return createResource(req, resource);
}

export async function PUT(req: Request, ctx: ResourceContext) {
  const { resource } = await ctx.params;
  return updateResource(req, resource);
}

export async function PATCH(req: Request, ctx: ResourceContext) {
  const { resource } = await ctx.params;
  return restoreResource(req, resource);
}

export async function DELETE(req: Request, ctx: ResourceContext) {
  const { resource } = await ctx.params;
  return deleteResource(req, resource);
}
