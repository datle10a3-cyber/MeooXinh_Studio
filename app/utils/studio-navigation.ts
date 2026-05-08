"use client";

type RouterLike = {
  push: (href: string, options?: { scroll?: boolean }) => void;
};

export const STUDIO_VIEW_NAVIGATION_EVENT = "studio-view-navigation";

/**
 * Chuyển đổi từ view ID sang đường dẫn thực (real route)
 */
export function studioViewPath(view: string, options: { tab?: string | null } = {}) {
  const normalizedView = (view || "home").trim().toLowerCase();
  
  // Home là root /
  let path = "/";
  if (normalizedView !== "home") {
    path = `/${normalizedView}`;
  }

  const params = new URLSearchParams();
  if (options.tab) params.set("tab", options.tab);
  
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

/**
 * Điều hướng sử dụng URL thực tế thay vì query params
 */
export function navigateStudioView(
  router: RouterLike,
  _pathname: string | null,
  view: string,
  options: { tab?: string | null; replace?: boolean } = {},
) {
  const target = studioViewPath(view, options);
  router.push(target, { scroll: false });
  
  // Vẫn dispatch event nếu cần đồng bộ UI nội bộ
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(STUDIO_VIEW_NAVIGATION_EVENT));
  }
  
  return target;
}

export function navigateStudioPath(router: RouterLike, _pathname: string | null, targetPath: string) {
  router.push(targetPath, { scroll: false });
  return targetPath;
}
