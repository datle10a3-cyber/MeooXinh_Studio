"use client";

import dynamic from "next/dynamic";

const AiAssistantView = dynamic(
  () =>
    import("@/app/components/ai/ai-assistant-view").then(
      (mod) => mod.AiAssistantView,
    ),
  { ssr: false },
);

export default function Page() {
  return <AiAssistantView />;
}
