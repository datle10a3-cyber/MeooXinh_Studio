import { fail, ok, serverError } from "@/app/lib/api-response";
import {
  buildStudioAIMessages,
  canViewStudioFinance,
  createAIActionSuggestions,
  fallbackStudioAnswer,
  financeAccessDeniedAnswer,
  getStudioAIContext,
  isFinanceQuestion,
  learnFromUserMessage,
  summarizeAIContext,
  type AIChatMessage,
  writeAIAuditLog,
} from "@/app/lib/ai-studio";
import { requireUser } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

function cleanEnv(value?: string) {
  return value?.trim().replace(/^["']|["']$/g, "") ?? "";
}

function groqApiKey() {
  return cleanEnv(process.env.GROQ_API_KEY);
}

const groqModel = cleanEnv(process.env.GROQ_MODEL) || "llama-3.1-8b-instant";
const groqVisionModel = cleanEnv(process.env.GROQ_VISION_MODEL) || "meta-llama/llama-4-scout-17b-16e-instruct";
const aiFaceEmojis = ["🙂", "😊", "😄", "🥰", "😌", "🤔", "😅", "😎", "🙏"];

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

function hasEndingFaceEmoji(text: string) {
  const trimmed = text.trimEnd();
  return aiFaceEmojis.some((emoji) => trimmed.endsWith(emoji));
}

function polishAnswer(text: string, question: string) {
  const trimmed = text.trimEnd();
  if (!trimmed || hasEndingFaceEmoji(trimmed)) return trimmed;
  return `${trimmed} ${contextualFaceEmoji(trimmed, question)}`;
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = (await req.json().catch(() => ({}))) as { messages?: AIChatMessage[] };
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const lastMessage = messages.filter((item) => item.role === "user").at(-1);
    const lastQuestion = lastMessage?.content?.trim() ?? "";
    const imageCount = Math.min((lastMessage?.imageDataUrls?.length || lastMessage?.imageUrls?.length || 0), 3);
    if (!lastQuestion && imageCount === 0) return fail("Vui lòng nhập câu hỏi hoặc gửi ảnh.", 422);

    await prisma.aiChatMessage.create({
      data: {
        studioId: user.studioId,
        userId: user.id,
        role: "user",
        content: imageCount > 0 ? `${lastQuestion || "Phân tích ảnh giúp mình"}\n[Đã gửi ${imageCount} ảnh]` : lastQuestion,
      },
    });

    if (!canViewStudioFinance(user.role) && isFinanceQuestion(lastQuestion)) {
      const text = financeAccessDeniedAnswer();
      await prisma.aiChatMessage.create({ data: { studioId: user.studioId, userId: user.id, role: "assistant", content: text } });
      await writeAIAuditLog({ user, question: lastQuestion, answer: text, mode: "blocked", imageCount, blocked: true });
      return ok({ mode: "blocked", message: text });
    }
    if (!canViewStudioFinance(user.role) && imageCount > 0 && !lastQuestion) {
      const text = "Bạn mô tả thêm ảnh này thuộc phần nào giúp mình nha. Nếu ảnh liên quan hóa đơn, QR, phiếu thu, phiếu chi hoặc tiền bạc thì chỉ Quản trị viên và Quản lý mới được hỏi.";
      await prisma.aiChatMessage.create({ data: { studioId: user.studioId, userId: user.id, role: "assistant", content: text } });
      await writeAIAuditLog({ user, question: "[Ảnh không kèm mô tả]", answer: text, mode: "blocked", imageCount, blocked: true });
      return ok({ mode: "blocked", message: text });
    }

    const learnedMemory = await learnFromUserMessage(user, lastQuestion).catch(() => null);
    const context = await getStudioAIContext(user, lastQuestion);
    const sourceSummary = summarizeAIContext(context);
    if (!hasGroqKey()) {
      const text = fallbackStudioAnswer(lastQuestion, context, "chưa có GROQ_API_KEY hợp lệ trong .env", imageCount);
      const finalText = polishAnswer(learnedMemory ? `${text}\n\n${learnedMemory.notice}` : text, lastQuestion);
      await createAIActionSuggestions(user, lastQuestion, context).catch(() => []);
      await prisma.aiChatMessage.create({ data: { studioId: user.studioId, userId: user.id, role: "assistant", content: finalText } });
      await writeAIAuditLog({ user, question: lastQuestion, answer: finalText, mode: "local", sourceSummary, imageCount });
      return ok({ mode: "local", message: finalText });
    }

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${groqApiKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: imageCount > 0 ? groqVisionModel : groqModel,
        temperature: 0.2,
        top_p: 0.85,
        max_completion_tokens: 900,
        messages: buildStudioAIMessages(messages, context),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      const text = fallbackStudioAnswer(lastQuestion, context, `model lỗi ${response.status}: ${errorText.slice(0, 220)}`, imageCount);
      const finalText = polishAnswer(learnedMemory ? `${text}\n\n${learnedMemory.notice}` : text, lastQuestion);
      await createAIActionSuggestions(user, lastQuestion, context).catch(() => []);
      await prisma.aiChatMessage.create({ data: { studioId: user.studioId, userId: user.id, role: "assistant", content: finalText } });
      await writeAIAuditLog({ user, question: lastQuestion, answer: finalText, mode: "local", sourceSummary, imageCount });
      return ok({ mode: "local", message: finalText });
    }

    const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const text = data.choices?.[0]?.message?.content?.trim() || fallbackStudioAnswer(lastQuestion, context, undefined, imageCount);
    const finalText = polishAnswer(learnedMemory ? `${text}\n\n${learnedMemory.notice}` : text, lastQuestion);
    await createAIActionSuggestions(user, lastQuestion, context).catch(() => []);
    await prisma.aiChatMessage.create({ data: { studioId: user.studioId, userId: user.id, role: "assistant", content: finalText } });
    await writeAIAuditLog({ user, question: lastQuestion, answer: finalText, mode: "model", sourceSummary, imageCount });
    return ok({ mode: "model", message: finalText });
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") return fail("Chưa đăng nhập.", 401);
    return serverError(error);
  }
}
