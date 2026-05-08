import type { Metadata, Viewport } from "next";
import { IosLaunchSplash } from "@/app/components/pwa/ios-launch-splash";
import { PwaInstaller } from "@/app/components/pwa/pwa-installer";
import { NetworkStatus } from "@/app/components/pwa/network-status";
import { AppLoader } from "@/app/components/ui/app-loader";
import NextTopLoader from "nextjs-toploader";
import "./globals.css";

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
            __html: `try{document.querySelectorAll('[fdprocessedid]').forEach(function(n){n.removeAttribute('fdprocessedid')})}catch(e){}
// Detect in-app browsers (Messenger, Facebook, Zalo, Instagram, Line)
try{
  var ua=navigator.userAgent||'';
  if(/FBAN|FBAV|Instagram|Zalo|Line|Messenger|MicroMessenger/i.test(ua)){
    var url=location.href;
    // On iOS, try intent to open Safari
    if(/iphone|ipad|ipod/i.test(ua)){
      // x-safari-https scheme opens Safari on iOS
      location.replace('x-safari-'+url.replace(/^https?/,'https'));
    }
  }
}catch(e){}`,
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
        <PwaInstaller />
        <NetworkStatus />
        {children}
      </body>
    </html>
  );
}
