import type { Metadata, Viewport } from "next";
import { IosLaunchSplash } from "@/app/components/pwa/ios-launch-splash";
import { NetworkStatus } from "@/app/components/pwa/network-status";
import { AppLoader } from "@/app/components/ui/app-loader";
import NextTopLoader from "nextjs-toploader";
import "./globals.css";

const appVersion = process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.NEXT_PUBLIC_APP_VERSION ?? "local";
const pwaAssetVersion = "5";

const mobileWebviewSafetyScript = `
(function(){
  try {
    var APP_VERSION = ${JSON.stringify(appVersion)};
    var ua = navigator.userAgent || "";
    var isInApp = /FBAN|FBAV|FB_IAB|Messenger|Instagram|Zalo|TikTok|Bytedance|Line|MicroMessenger|WeChat/i.test(ua);
    var isMobile = /Android|iPhone|iPad|iPod/i.test(ua);
    var isStandalone = false;
    try {
      isStandalone = !!(window.matchMedia && window.matchMedia("(display-mode: standalone)").matches);
    } catch (_) {}
    try {
      if (navigator && navigator.standalone === true) isStandalone = true;
    } catch (_) {}
    function storageGet(key) {
      try { return sessionStorage.getItem(key); } catch (_) { return null; }
    }
    function storageSet(key, value) {
      try { sessionStorage.setItem(key, value); } catch (_) {}
    }
    function localGet(key) {
      try { return localStorage.getItem(key); } catch (_) { return null; }
    }
    function localSet(key, value) {
      try { localStorage.setItem(key, value); } catch (_) {}
    }
    function clearStudioCaches() {
      if (window.caches && caches.keys) {
        return caches.keys().then(function(keys) {
          return Promise.all(keys.map(function(key) {
            if (/studio-|next-|workbox|precache/i.test(key)) return caches.delete(key);
            return Promise.resolve(false);
          }));
        }).catch(function(){});
      }
      return Promise.resolve();
    }
    function unregisterServiceWorkers() {
      if (!("serviceWorker" in navigator)) return Promise.resolve();
      return navigator.serviceWorker.getRegistrations().then(function(registrations) {
        return Promise.all(registrations.map(function(registration) {
          return registration.unregister();
        }));
      }).catch(function(){});
    }
    function safeReload(key, toRoot) {
      if (storageGet(key)) return;
      storageSet(key, "1");
      var reload = function() {
        if (toRoot && location.pathname !== "/") {
          location.replace("/");
          return;
        }
        location.reload();
      };
      if (isInApp || isMobile) {
        unregisterServiceWorkers().then(clearStudioCaches).then(reload).catch(reload);
      } else {
        clearStudioCaches().then(reload).catch(reload);
      }
    }
    var previousVersion = localGet("studio-app-version");
    if (previousVersion && previousVersion !== APP_VERSION) {
      localSet("studio-app-version", APP_VERSION);
      unregisterServiceWorkers().then(clearStudioCaches).then(function() {
        if (!storageGet("studio-reloaded-after-version-change")) {
          storageSet("studio-reloaded-after-version-change", "1");
          location.reload();
        }
      }).catch(function(){});
    } else if (!previousVersion) {
      localSet("studio-app-version", APP_VERSION);
    }
    if (!isStandalone && (isInApp || isMobile)) {
      unregisterServiceWorkers().then(clearStudioCaches).catch(function(){});
    } else if (isStandalone && "serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistrations().then(function(registrations) {
        registrations.forEach(function(registration) {
          registration.update();
        });
      }).catch(function(){});
    }
    window.addEventListener("error", function(event) {
      var target = event && event.target;
      var src = target && (target.src || target.href);
      var message = String((event && event.message) || "");
      if ((src && /\\/_next\\//.test(src)) || /ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module|Importing a module script failed|module script failed/i.test(message)) {
        safeReload("studio-reloaded-after-chunk-error", true);
      }
    }, true);
    window.addEventListener("unhandledrejection", function(event) {
      var reason = event && event.reason;
      var message = String((reason && (reason.message || reason.stack)) || reason || "");
      if (/ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module|Importing a module script failed|module script failed/i.test(message)) {
        safeReload("studio-reloaded-after-import-error", true);
      }
    });
  } catch (_) {}
})();
`;

export const metadata: Metadata = {
  title: "MÈOO XINHH STUDIO | Make & Photo",
  description: "Quản lý booking, tài chính, CRM và vận hành MÈOO XINHH STUDIO.",
  manifest: `/manifest.json?v=${pwaAssetVersion}`,
  icons: {
    icon: [
      { url: `/pwa-icon-192.png?v=${pwaAssetVersion}`, sizes: "192x192", type: "image/png" },
      { url: `/pwa-icon-512.png?v=${pwaAssetVersion}`, sizes: "512x512", type: "image/png" },
    ],
    apple: `/apple-touch-icon.png?v=${pwaAssetVersion}`,
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
    "application-name": "MÈOO XINHH STUDIO",
    "format-detection": "telephone=no",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#EA7188",
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
        <meta name="application-name" content="MÈOO XINHH STUDIO" />
        <meta name="theme-color" content="#EA7188" />
        <link rel="apple-touch-icon" href={`/apple-touch-icon.png?v=${pwaAssetVersion}`} />
        <link
          rel="apple-touch-startup-image"
          href={`/splash/splash-iphone-1170x2532.png?v=${pwaAssetVersion}`}
          media="screen and (device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)"
        />
        <link
          rel="apple-touch-startup-image"
          href={`/splash/splash-iphone-1284x2778.png?v=${pwaAssetVersion}`}
          media="screen and (device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)"
        />
        <link
          rel="apple-touch-startup-image"
          href={`/splash/splash-ipad-1536x2048.png?v=${pwaAssetVersion}`}
          media="screen and (device-width: 768px) and (device-height: 1024px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)"
        />
        <link
          rel="apple-touch-startup-image"
          href={`/splash/splash-ipad-1668x2388.png?v=${pwaAssetVersion}`}
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
