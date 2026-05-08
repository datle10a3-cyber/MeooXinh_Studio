import type { Metadata, Viewport } from "next";
import { IosLaunchSplash } from "@/app/components/pwa/ios-launch-splash";
import { NetworkStatus } from "@/app/components/pwa/network-status";
import { AppLoader } from "@/app/components/ui/app-loader";
import NextTopLoader from "nextjs-toploader";
import "./globals.css";

const mobileWebviewSafetyScript = `
(function(){
  try {
    var ua = navigator.userAgent || "";
    var isInApp = /FBAN|FBAV|FB_IAB|Messenger|Instagram|Zalo|TikTok|Bytedance|Line|MicroMessenger/i.test(ua);
    var isStandalone = false;
    try {
      isStandalone = window.matchMedia && window.matchMedia("(display-mode: standalone)").matches;
    } catch (_) {}
    if (isInApp && !isStandalone && "serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistrations().then(function(registrations) {
        registrations.forEach(function(registration) {
          registration.unregister();
        });
      }).catch(function(){});
      if (window.caches && caches.keys) {
        caches.keys().then(function(keys) {
          keys.forEach(function(key) {
            if (/studio-|next-|workbox|precache/i.test(key)) caches.delete(key);
          });
        }).catch(function(){});
      }
    }
    window.addEventListener("error", function(event) {
      var target = event && event.target;
      var src = target && (target.src || target.href);
      if (src && /\\/_next\\//.test(src) && !sessionStorage.getItem("studio-reloaded-after-chunk-error")) {
        sessionStorage.setItem("studio-reloaded-after-chunk-error", "1");
        window.location.reload();
      }
    }, true);
    window.addEventListener("unhandledrejection", function(event) {
      var reason = event && event.reason;
      var message = String((reason && (reason.message || reason.stack)) || reason || "");
      if (/ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module|Importing a module script failed/i.test(message) && !sessionStorage.getItem("studio-reloaded-after-import-error")) {
        sessionStorage.setItem("studio-reloaded-after-import-error", "1");
        window.location.reload();
      }
    });
  } catch (_) {}
})();
`;

export const metadata: Metadata = {
  title: "MÈOO XINHH STUDIO | Make & Photo",
  description: "Quản lý booking, tài chính, CRM và vận hành MÈOO XINHH STUDIO.",
  manifest: "/manifest.json?v=3",
  icons: {
    icon: [
      { url: "/pwa-icon-192.png?v=3", sizes: "192x192", type: "image/png" },
      { url: "/pwa-icon-512.png?v=3", sizes: "512x512", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png?v=3",
  },
  appleWebApp: {
    capable: true,
    title: "MÈOO XINHH STUDIO",
    statusBarStyle: "black-translucent",
  },
  applicationName: "MÈOO XINHH STUDIO",
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "black-translucent",
    "apple-mobile-web-app-title": "MÈOO XINHH STUDIO",
    "format-detection": "telephone=no",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#f5a3c7",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: "try{document.querySelectorAll('[fdprocessedid]').forEach(function(n){n.removeAttribute('fdprocessedid')})}catch(e){}",
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: mobileWebviewSafetyScript,
          }}
        />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Mèoo Xinhh Studio" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link
          rel="apple-touch-startup-image"
          href="/splash/splash-iphone-1170x2532.png"
          media="screen and (device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)"
        />
        <link
          rel="apple-touch-startup-image"
          href="/splash/splash-iphone-1284x2778.png"
          media="screen and (device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)"
        />
        <link
          rel="apple-touch-startup-image"
          href="/splash/splash-ipad-1536x2048.png"
          media="screen and (device-width: 768px) and (device-height: 1024px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)"
        />
        <link
          rel="apple-touch-startup-image"
          href="/splash/splash-ipad-1668x2388.png"
          media="screen and (device-width: 834px) and (device-height: 1194px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)"
        />
      </head>
      <body suppressHydrationWarning className="antialiased">
        <NextTopLoader color="#EA7188" height={3} showSpinner={false} shadow="0 0 10px #EA7188,0 0 5px #EA7188" zIndex={1600} />
        <AppLoader />
        <IosLaunchSplash />
        <NetworkStatus />
        {children}
      </body>
    </html>
  );
}
