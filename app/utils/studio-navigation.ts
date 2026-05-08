"use client";

type RouterLike = {
  push: (href: string, options?: { scroll?: boolean }) => void;
};

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
  view: string,
  options: { tab?: string | null } = {},
) {
  const target = studioViewPath(view, options);
  router.push(target, { scroll: false });
  return target;
}

export function navigateStudioPath(router: RouterLike, targetPath: string) {
  router.push(targetPath, { scroll: false });
  return targetPath;
}
