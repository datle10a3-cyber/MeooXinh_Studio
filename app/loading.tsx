/**
 * Root-level loading fallback for Next.js route transitions.
 *
 * IMPORTANT: This must be INVISIBLE / minimal to avoid the
 * "flash of grey/white" that occurs when Next.js replaces the
 * page content with this component during client-side navigation.
 *
 * On iPad/tablet, a full-screen skeleton here causes the entire
 * <main> area to repaint, producing the visible "grey flash" jank.
 *
 * Solution: render nothing visible. The individual page components
 * already have their own PageSpinner / initialLoading states that
 * show inline loading indicators without replacing the AppShell layout.
 */
export default function Loading() {
  // Render an invisible placeholder — occupies no visual space,
  // prevents layout shift, and avoids the full-page repaint.
  return null;
}
