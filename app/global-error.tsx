"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global Error Boundary:", error);
  }, [error]);

  return (
    <html lang="vi">
      <body>
        <main style={{ minHeight: "100dvh", background: "#FFF3EC", color: "#5B342C", display: "grid", placeItems: "center", padding: 24, fontFamily: "sans-serif" }}>
          <section style={{ width: "100%", maxWidth: 560, border: "1px solid #F4C7C4", borderRadius: 32, background: "rgba(255,255,255,0.92)", padding: 32, textAlign: "center", boxShadow: "0 22px 60px rgba(184,95,108,0.16)" }}>
            <p style={{ margin: 0, color: "#EA7188", fontSize: 12, fontWeight: 900, letterSpacing: "0.22em", textTransform: "uppercase" }}>Mèoo Xinhh Studio</p>
            <h1 style={{ margin: "12px 0 0", fontSize: 24, fontWeight: 900 }}>Ứng dụng gặp sự cố</h1>
            <p style={{ margin: "8px 0 0", color: "#9B746B", fontSize: 14, fontWeight: 650 }}>Không thể khởi động ứng dụng. Hãy thử tải lại trang web.</p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginTop: 24 }}>
              <button style={{ border: 0, borderRadius: 999, background: "#EA7188", color: "white", padding: "12px 24px", fontWeight: 900, cursor: "pointer" }} onClick={() => window.location.reload()}>
                Tải lại trang
              </button>
              <button style={{ border: "1px solid #F4C7C4", borderRadius: 999, background: "white", color: "#5B342C", padding: "12px 24px", fontWeight: 900, cursor: "pointer" }} onClick={() => window.location.href = "/"}>
                Về trang chính
              </button>
            </div>
          </section>
        </main>
      </body>
    </html>
  );
}
