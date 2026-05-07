import {
  buildStudioAIMessages,
  canViewStudioFinance,
  createAIActionSuggestions,
  fallbackStudioAnswer,
  financeAccessDeniedAnswer,
  getMinimalStudioAIContext,
  getStudioAIContext,
  isFinanceQuestion,
  learnFromUserMessage,
  summarizeAIContext,
  type AIChatMessage,
  writeAIAuditLog,
} from "@/app/lib/ai-studio";
import { requireUser } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

export const maxDuration = 30;

const encoder = new TextEncoder();
const GROQ_TIMEOUT_MS = 18000;
function cleanEnv(value?: string) {
  return value?.trim().replace(/^["']|["']$/g, "") ?? "";
}

function groqApiKey() {
  return cleanEnv(process.env.GROQ_API_KEY);
}

const groqModel = cleanEnv(process.env.GROQ_MODEL) || "llama-3.1-8b-instant";
const groqVisionModel = cleanEnv(process.env.GROQ_VISION_MODEL) || "meta-llama/llama-4-scout-17b-16e-instruct";
const aiFaceEmojis = ["🙂", "😊", "😄", "🥰", "😌", "🤔", "😅", "😎", "🙏"];

function chunkText(text: string) {
  return text.match(/.{1,42}/g) ?? [text];
}

function hasGroqKey() {
  const key = groqApiKey();
  return Boolean(key && key.startsWith("gsk_") && !key.includes("xxxxxx"));
}

function normalizeMoodText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

function contextualFaceEmoji(text: string, question: string) {
  const mood = normalizeMoodText(`${question} ${text}`);
  if (/(bao mat|canh bao|nguy hiem|khan cap|bi lo|hack|loi nghiem trong)/.test(mood)) return "🙏";
  if (/(loi|ban|gioi han|khong the|chua the|that bai|tu choi|khong duoc quyen|khong co quyen)/.test(mood)) return "😅";
  if (/(goi y|nen|kiem tra|phan tich|vi sao|tai sao|can xem|can ra soat)/.test(mood)) return "🤔";
  if (/(doanh thu|bao cao|so lieu|tong quan|thong ke|loi nhuan|thu chi|hoa don)/.test(mood)) return "😎";
  if (/(cam on|xin chao|chao ban|de thuong|rat vui|nha)/.test(mood)) return "🥰";
  if (/(xong|hoan tat|thanh cong|da cap nhat|da dong bo|on roi|tot)/.test(mood)) return "😊";
  return "🙂";
}

function missingFaceEmoji(text: string) {
  const trimmed = text.trimEnd();
  return !aiFaceEmojis.some((emoji) => trimmed.endsWith(emoji));
}

async function writeSlowly(controller: ReadableStreamDefaultController<Uint8Array>, text: string) {
  for (const chunk of chunkText(text)) {
    controller.enqueue(encoder.encode(chunk));
    await new Promise((resolve) => setTimeout(resolve, 8));
  }
}

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function POST(req: Request) {
  const user = await requireUser().catch(() => null);
  if (!user) {
    return new Response("Phiên đăng nhập đã hết hạn. Bạn đăng nhập lại rồi hỏi AI tiếp giúp mình.", {
      status: 401,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  }
  const body = (await req.json().catch(() => ({}))) as { messages?: AIChatMessage[] };
  const messages = Array.isArray(body.messages) ? body.messages : [];
  const lastMessage = messages.filter((item) => item.role === "user").at(-1);
  const lastQuestion = lastMessage?.content?.trim() ?? "";
  const imageCount = Math.min((lastMessage?.imageDataUrls?.length || lastMessage?.imageUrls?.length || 0), 3);

  if (!lastQuestion && imageCount === 0) {
    return new Response("Bạn nhập câu hỏi hoặc gửi ảnh giúp mình nhé.", {
      status: 422,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  }

  const learnedMemory = await learnFromUserMessage(user, lastQuestion).catch(() => null);
  const context = await getStudioAIContext(user, lastQuestion).catch((error) =>
    getMinimalStudioAIContext(user, error instanceof Error ? error.message : "context error"),
  );
  const sourceSummary = summarizeAIContext(context);
  await prisma.aiChatMessage.create({
    data: {
      studioId: user.studioId,
      userId: user.id,
      role: "user",
      content: imageCount > 0 ? `${lastQuestion || "Phân tích ảnh giúp mình"}\n[Đã gửi ${imageCount} ảnh]` : lastQuestion,
    },
  }).catch(() => null);

  if (!canViewStudioFinance(user.role) && isFinanceQuestion(lastQuestion)) {
    const text = financeAccessDeniedAnswer();
    await prisma.aiChatMessage.create({ data: { studioId: user.studioId, userId: user.id, role: "assistant", content: text } });
    await writeAIAuditLog({ user, question: lastQuestion, answer: text, mode: "blocked", imageCount, blocked: true });
    return new Response(text, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
  }
  if (!canViewStudioFinance(user.role) && imageCount > 0 && !lastQuestion) {
    const text = "Bạn mô tả thêm ảnh này thuộc phần nào giúp mình nha. Nếu ảnh liên quan hóa đơn, QR, phiếu thu, phiếu chi hoặc tiền bạc thì chỉ Quản trị viên và Quản lý mới được hỏi.";
    await prisma.aiChatMessage.create({ data: { studioId: user.studioId, userId: user.id, role: "assistant", content: text } });
    await writeAIAuditLog({ user, question: "[Ảnh không kèm mô tả]", answer: text, mode: "blocked", imageCount, blocked: true });
    return new Response(text, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let finalText = "";
      try {
        if (hasGroqKey()) {
          const response = await fetchWithTimeout("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: { Authorization: `Bearer ${groqApiKey()}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: imageCount > 0 ? groqVisionModel : groqModel,
              stream: true,
              temperature: 0.2,
              top_p: 0.85,
              max_completion_tokens: 900,
              messages: buildStudioAIMessages(messages, context),
            }),
          }, GROQ_TIMEOUT_MS);

          if (!response.ok) {
            const text = await response.text().catch(() => "");
            finalText = fallbackStudioAnswer(lastQuestion, context, `model lỗi ${response.status}: ${text.slice(0, 220)}`, imageCount);
            await writeSlowly(controller, finalText);
          } else if (response.body) {
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = "";
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split("\n");
              buffer = lines.pop() ?? "";
              for (const line of lines) {
                if (!line.startsWith("data: ")) continue;
                const raw = line.slice(6).trim();
                if (!raw || raw === "[DONE]") continue;
                try {
                  const event = JSON.parse(raw) as { choices?: Array<{ delta?: { content?: string } }> };
                  const delta = event.choices?.[0]?.delta?.content ?? "";
                  if (delta) {
                    finalText += delta;
                    controller.enqueue(encoder.encode(delta));
                  }
                } catch {
                  // Bỏ qua chunk lỗi để không làm đứt luồng trả lời.
                }
              }
            }
          }
        }

        if (!finalText) {
          finalText = hasGroqKey()
            ? fallbackStudioAnswer(lastQuestion, context, undefined, imageCount)
            : fallbackStudioAnswer(lastQuestion, context, "chưa có GROQ_API_KEY hợp lệ trong .env", imageCount);
          await writeSlowly(controller, finalText);
        }

        if (learnedMemory) {
          const memoryNotice = `\n\n${learnedMemory.notice}`;
          finalText += memoryNotice;
          controller.enqueue(encoder.encode(memoryNotice));
        }

        if (missingFaceEmoji(finalText)) {
          const emoji = ` ${contextualFaceEmoji(finalText, lastQuestion)}`;
          finalText += emoji;
          controller.enqueue(encoder.encode(emoji));
        }

        await createAIActionSuggestions(user, lastQuestion, context).catch(() => []);
        await prisma.aiChatMessage.create({ data: { studioId: user.studioId, userId: user.id, role: "assistant", content: finalText } });
        await writeAIAuditLog({ user, question: lastQuestion, answer: finalText, mode: hasGroqKey() ? "model" : "local", sourceSummary, imageCount });
      } catch (error) {
        finalText = fallbackStudioAnswer(lastQuestion, context, error instanceof Error ? error.message : "không rõ lỗi", imageCount);
        controller.enqueue(encoder.encode(finalText));
        await prisma.aiChatMessage.create({ data: { studioId: user.studioId, userId: user.id, role: "assistant", content: finalText } }).catch(() => null);
        await writeAIAuditLog({ user, question: lastQuestion, answer: finalText, mode: "error", sourceSummary, imageCount }).catch(() => null);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
}
