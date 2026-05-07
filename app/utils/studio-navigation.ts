"use client";

type RouterLike = {
  push: (href: string, options?: { scroll?: boolean }) => void;
};

export const STUDIO_VIEW_NAVIGATION_EVENT = "studio-view-navigation";

export function studioViewPath(view: string, options: { tab?: string | null } = {}) {
  const normalizedView = view.trim() || "home";
  const params = new URLSearchParams();
  if (normalizedView !== "home") params.set("view", normalizedView);
  if (options.tab) params.set("tab", options.tab);
  const query = params.toString();
  return query ? `/?${query}` : "/";
}

export function pushStudioViewUrl(view: string, options: { tab?: string | null; replace?: boolean } = {}) {
  const target = studioViewPath(view, options);
  if (typeof window === "undefined") return target;

  const current = `${window.location.pathname}${window.location.search}`;
  if (current !== target) {
    const method = options.replace ? "replaceState" : "pushState";
    window.history[method](null, "", target);
  }
  window.dispatchEvent(new Event(STUDIO_VIEW_NAVIGATION_EVENT));
  return target;
}

export function navigateStudioView(
  router: RouterLike,
  pathname: string | null,
  view: string,
  options: { tab?: string | null; replace?: boolean } = {},
) {
  const currentPathname = pathname || (typeof window !== "undefined" ? window.location.pathname : "");
  if (currentPathname === "/") {
    return pushStudioViewUrl(view, options);
  }
  const target = studioViewPath(view, options);
  router.push(target, { scroll: false });
  return target;
}

export function navigateStudioPath(router: RouterLike, pathname: string | null, targetPath: string) {
  const url = new URL(targetPath, "https://studio.local");
  if (url.pathname === "/") {
    const view = url.searchParams.get("view") || "home";
    return navigateStudioView(router, pathname, view, { tab: url.searchParams.get("tab") });
  }
  router.push(targetPath, { scroll: false });
  return targetPath;
}
