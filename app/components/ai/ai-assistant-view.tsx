"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, CheckCircle2, Database, ImagePlus, Lightbulb, RotateCcw, Send, Sparkles, User, X } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Card, CardTitle } from "@/app/components/ui/card";
import { StudioBrandPanel } from "@/app/components/brand/studio-brand";
import { Textarea } from "@/app/components/ui/input";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  imageDataUrls?: string[];
};

type AiActionSuggestion = {
  id: string;
  type: string;
  title: string;
  description: string;
  payload: Record<string, unknown>;
  status: string;
};

function cleanAssistantText(text: string) {
  const lower = text.toLowerCase();
  if (lower.includes("rate limit") || lower.includes("tokens per day") || lower.includes('"error"') || lower.includes("service_tier")) {
    return "AI Ä‘ang báº­n hoáº·c Ä‘Ă£ cháº¡m giá»›i háº¡n táº¡m thá»i. MĂ¬nh sáº½ tráº£ lá»i báº±ng dá»¯ liá»‡u ná»™i bá»™ cá»§a studio trÆ°á»›c nha. Báº¡n cĂ³ thá»ƒ há»i láº¡i sau Ă­t phĂºt Ä‘á»ƒ AI phĂ¢n tĂ­ch sĂ¢u hÆ¡n.";
  }
  return text;
}

export function AiAssistantView() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "ChĂ o báº¡n, mĂ¬nh lĂ  trá»£ lĂ½ AI cá»§a MĂ¨oo Xinhh. MĂ¬nh Ä‘Ă£ Ä‘Æ°á»£c Ä‘á»“ng bá»™ vá»›i dá»¯ liá»‡u studio: booking, khĂ¡ch hĂ ng, gĂ³i chá»¥p, thu chi, hĂ³a Ä‘Æ¡n, vĂ­, ca lĂ m, dá»± Ă¡n, nhĂ¢n sá»±, thiáº¿t bá»‹, thĂ´ng bĂ¡o vĂ  lá»‹ch sá»­ hoáº¡t Ä‘á»™ng.",
    },
  ]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [imageDataUrls, setImageDataUrls] = useState<string[]>([]);
  const [actions, setActions] = useState<AiActionSuggestion[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const suggestionDragRef = useRef({ active: false, moved: false, startX: 0, scrollLeft: 0 });
  const skipSuggestionClickUntilRef = useRef(0);
  const suggestions = [
    "TĂ³m táº¯t studio hĂ´m nay",
    "HĂ´m nay cĂ³ booking nĂ o?",
    "ThĂ¡ng nĂ y thu chi sao?",
    "Ca nĂ o Ä‘ang má»Ÿ?",
    "HĂ³a Ä‘Æ¡n nĂ o cĂ²n ná»£?",
    "Thiáº¿t bá»‹ nĂ o cáº§n chĂº Ă½?",
    "Nhá»› lĂ  hĂ£y tráº£ lá»i dá»… thÆ°Æ¡ng nhÆ°ng gá»n gĂ ng",
    "KhĂ¡ch nĂ o sáº¯p tá»›i lá»‹ch chá»¥p?",
    "Booking nĂ o chÆ°a cĂ³ áº£nh?",
    "Booking nĂ o chÆ°a hoĂ n táº¥t?",
    "KhĂ¡ch nĂ o quay láº¡i nhiá»u nháº¥t?",
    "GĂ³i chá»¥p nĂ o bĂ¡n cháº¡y nháº¥t?",
    "Doanh thu tuáº§n nĂ y bao nhiĂªu?",
    "Khoáº£n chi nĂ o lá»›n nháº¥t thĂ¡ng nĂ y?",
    "Dá»± Ă¡n nĂ o Ä‘ang xá»­ lĂ½?",
    "NhĂ¢n sá»± nĂ o cĂ³ lá»‹ch hĂ´m nay?",
    "Kiá»ƒm tra hĂ³a Ä‘Æ¡n vĂ  phiáº¿u thu hĂ´m nay",
  ];

  async function loadActions() {
    const result = await fetch("/api/ai/actions")
      .then((res) => res.json())
      .catch(() => null);
    setActions(Array.isArray(result?.data) ? result.data : []);
  }

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      const historyResult = await fetch("/api/ai/chat/history")
        .then((res) => res.json())
        .catch(() => null);
      if (Array.isArray(historyResult?.data) && historyResult.data.length > 0) {
        setMessages(historyResult.data.map((item: ChatMessage) => ({ role: item.role, content: item.role === "assistant" ? cleanAssistantText(item.content) : item.content })));
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadActions();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function fileToDataUrl(file: File) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  async function pickImages(files: FileList | null) {
    if (!files?.length) return;
    setNotice("");
    const selected = Array.from(files)
      .filter((file) => file.type.startsWith("image/"))
      .slice(0, Math.max(0, 3 - imageDataUrls.length));
    if (!selected.length) {
      setNotice("Báº¡n chá»n file áº£nh giĂºp mĂ¬nh nha.");
      return;
    }
    const tooLarge = selected.find((file) => file.size > 4 * 1024 * 1024);
    if (tooLarge) {
      setNotice("áº¢nh hÆ¡i náº·ng rá»“i, báº¡n chá»n áº£nh dÆ°á»›i 4 MB Ä‘á»ƒ AI Ä‘á»c mÆ°á»£t hÆ¡n nha.");
      return;
    }
    const dataUrls = await Promise.all(selected.map(fileToDataUrl));
    setImageDataUrls((current) => [...current, ...dataUrls].slice(0, 3));
    if (fileRef.current) fileRef.current.value = "";
  }

  async function send(prompt = input, images = imageDataUrls) {
    if ((!prompt.trim() && images.length === 0) || loading) return;
    setNotice("");
    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: prompt || "PhĂ¢n tĂ­ch áº£nh giĂºp mĂ¬nh", imageDataUrls: images }];
    setMessages(nextMessages);
    setInput("");
    setImageDataUrls([]);
    setLoading(true);

    try {
      const response = await fetch("/api/ai/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages }),
      }).catch(() => null);

      if (!response?.ok || !response.body) {
        const text = await response?.text().catch(() => "");
        setMessages([...nextMessages, { role: "assistant", content: cleanAssistantText(text || "MĂ¬nh chÆ°a tráº£ lá»i Ä‘Æ°á»£c lĂºc nĂ y. Báº¡n thá»­ láº¡i giĂºp mĂ¬nh.") }]);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantText = "";
      setMessages([...nextMessages, { role: "assistant", content: "" }]);
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        assistantText += decoder.decode(value, { stream: true });
        setMessages([...nextMessages, { role: "assistant", content: cleanAssistantText(assistantText) }]);
      }
      await loadActions();
    } catch {
      const errorMessage = "\u004d\u00ecnh b\u1ecb m\u1ea5t k\u1ebft n\u1ed1i AI t\u1ea1m th\u1eddi. B\u1ea1n th\u1eed g\u1eedi l\u1ea1i gi\u00fap m\u00ecnh.";
      setMessages([...nextMessages, { role: "assistant", content: errorMessage }]);
    } finally {
      setLoading(false);
    }
  }

  async function decideAction(id: string, decision: "APPROVE" | "REJECT") {
    setNotice("");
    const result = await fetch("/api/ai/actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, decision }),
    })
      .then((res) => res.json())
      .catch(() => null);
    if (result?.error) {
      setNotice(result.error.message ?? "ChÆ°a xá»­ lĂ½ Ä‘Æ°á»£c Ä‘á» xuáº¥t AI.");
      return;
    }
    setNotice(decision === "APPROVE" ? "ÄĂ£ xĂ¡c nháº­n Ä‘á» xuáº¥t AI." : "ÄĂ£ bá» qua Ä‘á» xuáº¥t AI.");
    await loadActions();
  }

  async function clearHistory() {
    const result = await fetch("/api/ai/chat/history", { method: "DELETE" })
      .then((res) => res.json())
      .catch(() => null);
    if (result?.error) {
      setNotice(result.error.message ?? "Báº¡n khĂ´ng cĂ³ quyá»n xĂ³a lá»‹ch sá»­ chat.");
      return;
    }
    setMessages([
      {
        role: "assistant",
        content: "MĂ¬nh Ä‘Ă£ xĂ³a lá»‹ch sá»­ chat trĂªn mĂ¡y chá»§. Báº¡n cĂ³ thá»ƒ báº¯t Ä‘áº§u cuá»™c trĂ² chuyá»‡n má»›i.",
      },
    ]);
  }

  function startSuggestionDrag(event: React.PointerEvent<HTMLDivElement>) {
    const target = suggestionsRef.current;
    if (!target) return;
    suggestionDragRef.current = {
      active: true,
      moved: false,
      startX: event.clientX,
      scrollLeft: target.scrollLeft,
    };
    target.setPointerCapture?.(event.pointerId);
  }

  function moveSuggestionDrag(event: React.PointerEvent<HTMLDivElement>) {
    const target = suggestionsRef.current;
    const drag = suggestionDragRef.current;
    if (!target || !drag.active) return;
    const deltaX = event.clientX - drag.startX;
    if (Math.abs(deltaX) > 4) {
      drag.moved = true;
      target.scrollLeft = drag.scrollLeft - deltaX;
      event.preventDefault();
    }
  }

  function endSuggestionDrag(event: React.PointerEvent<HTMLDivElement>) {
    const target = suggestionsRef.current;
    if (suggestionDragRef.current.moved) {
      skipSuggestionClickUntilRef.current = Date.now() + 250;
    }
    suggestionDragRef.current.active = false;
    target?.releasePointerCapture?.(event.pointerId);
  }

  return (
    <div className="space-y-6">
      <StudioBrandPanel
        eyebrow="Trá»£ lĂ½ AI"
        title="AI studio"
        description="Chat tá»± nhiĂªn, Ä‘á»c dá»¯ liá»‡u studio, phĂ¢n tĂ­ch áº£nh vĂ  há»— trá»£ há»i vá» booking, khĂ¡ch hĂ ng, tĂ i chĂ­nh, vĂ­, ca lĂ m vĂ  váº­n hĂ nh."
      />

      <div className="grid gap-5">
        <Card className="flex min-h-[78vh] flex-col overflow-hidden p-0">
          <div className="border-b border-[#F4C7C4] bg-white p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                  <CardTitle className="mr-1 w-full text-xl sm:w-auto sm:text-2xl">Cuá»™c trĂ² chuyá»‡n</CardTitle>
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#E9FFF5] px-2.5 py-1 text-[11px] font-black text-[#00885B] sm:px-3 sm:text-xs">
                    <Database size={13} />
                    ÄĂ£ Ä‘á»“ng bá»™ dá»¯ liá»‡u
                  </span>
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#FFF0F4] px-2.5 py-1 text-[11px] font-black text-[#EA7188] sm:px-3 sm:text-xs">
                    <Sparkles size={13} />
                    Dá»… thÆ°Æ¡ng, chuyĂªn nghiá»‡p
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[#A84E61] sm:line-clamp-none sm:text-sm">
                  AI Ä‘á»c dá»¯ liá»‡u studio theo quyá»n tĂ i khoáº£n vĂ  cĂ³ thá»ƒ nháº­n áº£nh Ä‘á»ƒ há»— trá»£ xem hĂ³a Ä‘Æ¡n, QR, chá»©ng tá»«, thiáº¿t bá»‹, áº£nh khĂ¡ch hoáº·c áº£nh lá»—i giao diá»‡n.
                </p>
              </div>
              <Button
                variant="secondary"
                className="min-h-10 w-full rounded-2xl px-4 text-sm shadow-[0_12px_24px_rgba(184,95,108,0.12)] sm:min-h-12 sm:w-auto sm:px-5"
                onClick={() => void clearHistory()}
              >
                <RotateCcw size={16} />
                XĂ³a lá»‹ch sá»­
              </Button>
            </div>
          </div>
          {notice ? <div className="border-b border-[#F4C7C4] bg-[#FFF8F1] px-5 py-3 text-sm font-bold text-[#A84E61]">{notice}</div> : null}
          <div className="relative border-b border-[#F4C7C4] bg-white py-3">
            <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-5 bg-gradient-to-r from-white to-transparent" />
            <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-9 bg-gradient-to-l from-white to-transparent" />
            <div
              ref={suggestionsRef}
              onPointerDown={startSuggestionDrag}
              onPointerMove={moveSuggestionDrag}
              onPointerUp={endSuggestionDrag}
              onPointerCancel={endSuggestionDrag}
              className="flex max-w-full cursor-grab touch-pan-x gap-2 overflow-x-scroll overscroll-x-contain px-4 pb-1 active:cursor-grabbing [-webkit-overflow-scrolling:touch] [-ms-overflow-style:none] [scrollbar-width:none] sm:px-5 [&::-webkit-scrollbar]:hidden"
              style={{ touchAction: "pan-x" }}
            >
            {suggestions.map((item) => (
              <button
                key={item}
                type="button"
                disabled={loading}
                onClick={(event) => {
                  if (Date.now() < skipSuggestionClickUntilRef.current) {
                    event.preventDefault();
                    return;
                  }
                  void send(item);
                }}
                className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-2xl border border-[#F4C7C4] bg-[#FFF8F1] px-3 py-2 text-xs font-black text-[#5B342C] shadow-sm transition hover:border-[#EA7188] hover:bg-[#FFF0F4] disabled:opacity-60"
              >
                <Lightbulb size={14} className="text-[#EA7188]" />
                {item}
              </button>
            ))}
            </div>
          </div>
          <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto bg-[#FFF3EC]/70 p-4 sm:p-6">
            {messages.map((message, index) => (
              <div key={`${message.role}-${index}`} className={message.role === "user" ? "flex justify-end" : "flex justify-start"}>
                <div
                  className={
                    message.role === "user"
                      ? "flex max-w-[92%] gap-3 rounded-[1.25rem] bg-[#EA7188] px-4 py-3 text-white shadow-sm sm:max-w-[78%]"
                      : "flex max-w-[92%] gap-3 rounded-[1.25rem] bg-white px-4 py-3 text-[#5B342C] shadow-sm ring-1 ring-[#F4C7C4] sm:max-w-[78%]"
                  }
                >
                  <div
                    className={
                      message.role === "user"
                        ? "mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/15"
                        : "mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#FFE4EA] text-[#8C655E]"
                    }
                  >
                    {message.role === "user" ? <User size={15} /> : <Bot size={15} />}
                  </div>
                  <div className="min-w-0">
                    <p className="whitespace-pre-line text-sm leading-6 sm:text-base sm:leading-7">{message.content || "Äang tráº£ lá»i..."}</p>
                    {message.imageDataUrls?.length ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {message.imageDataUrls.map((src, imageIndex) => (
                          <img
                            key={`${src.slice(0, 30)}-${imageIndex}`}
                            src={src}
                            alt="áº¢nh Ä‘Ă£ gá»­i cho AI"
                            className="h-20 w-20 rounded-2xl object-cover ring-1 ring-white/60"
                          />
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
          {actions.length ? (
            <div className="border-t border-[#F4C7C4] bg-[#FFF8F1] p-4 sm:p-5">
              <div className="mb-3 flex items-center gap-2 text-sm font-black text-[#5B342C]">
                <Sparkles size={16} className="text-[#EA7188]" />
                Äá» xuáº¥t thao tĂ¡c cáº§n xĂ¡c nháº­n
              </div>
              <div className="space-y-2">
                {actions.map((action) => (
                  <div key={action.id} className="rounded-2xl border border-[#F4C7C4] bg-white p-3 shadow-sm">
                    <p className="text-sm font-black text-[#5B342C]">{action.title}</p>
                    <p className="mt-1 text-xs leading-5 text-[#8C655E]">{action.description}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {action.type === "OPEN_VIEW" ? (
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => {
                            const view = String(action.payload?.view ?? "");
                            if (view) window.location.href = `/?view=${view}`;
                          }}
                        >
                          Má»Ÿ mĂ n hĂ¬nh
                        </Button>
                      ) : (
                        <Button type="button" size="sm" onClick={() => void decideAction(action.id, "APPROVE")}>
                          <CheckCircle2 size={15} />
                          XĂ¡c nháº­n
                        </Button>
                      )}
                      <Button type="button" variant="secondary" size="sm" onClick={() => void decideAction(action.id, "REJECT")}>
                        Bá» qua
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          <div className="border-t border-[#F4C7C4] bg-white p-3 sm:p-5">
            {imageDataUrls.length ? (
              <div className="mb-3 flex flex-wrap gap-2">
                {imageDataUrls.map((src, index) => (
                  <div key={`${src.slice(0, 30)}-${index}`} className="relative h-20 w-20 overflow-hidden rounded-2xl border border-[#F4C7C4] bg-[#FFF8F1]">
                    <img src={src} alt="áº¢nh chuáº©n bá»‹ gá»­i" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      className="absolute right-1 top-1 grid h-7 w-7 place-items-center rounded-full bg-white text-[#5B342C] shadow-sm"
                      onClick={() => setImageDataUrls((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                      aria-label="Bá» áº£nh"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
            <div className="flex gap-2 sm:gap-3">
              <Textarea
                className="min-h-20 rounded-[1.5rem] text-base leading-7 sm:min-h-24"
                value={input}
                placeholder="Nháº­p tin nháº¯n hoáº·c gá»­i áº£nh cho AI..."
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void send();
                  }
                }}
              />
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(event) => void pickImages(event.target.files)}
              />
              <Button
                type="button"
                variant="secondary"
                className="min-h-20 rounded-[1.5rem] px-4 sm:min-h-24"
                disabled={loading || imageDataUrls.length >= 3}
                onClick={() => fileRef.current?.click()}
                aria-label="Gá»­i áº£nh cho AI"
              >
                <ImagePlus size={24} />
              </Button>
              <Button className="min-h-20 rounded-[1.5rem] px-5 sm:min-h-24 sm:px-7" disabled={loading} onClick={() => void send()} aria-label="Gá»­i tin nháº¯n">
                <Send size={24} />
                <span className="hidden text-base font-black sm:inline">Gá»­i</span>
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
