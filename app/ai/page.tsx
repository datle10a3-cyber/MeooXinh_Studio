"use client";

import { AppShell } from "@/app/components/layout/app-shell";
import dynamic from "next/dynamic";

const AiAssistantView = dynamic(
  () =>
    import("@/app/components/ai/ai-assistant-view").then(
      (mod) => mod.AiAssistantView,
    ),
  { ssr: false },
);

export default function Page() {
  return (
    <AppShell>
      <AiAssistantView />
    </AppShell>
  );
}
