import webpush from "web-push";
import { prisma } from "@/app/lib/prisma";

function configureWebPush() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:studio@example.com";
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  return true;
}

export async function sendStudioPush(studioId: string, payload: { title: string; body: string; url?: string; tag?: string }) {
  if (!configureWebPush()) return;
  
  // Lấy danh sách các subscription của studio này, nhưng lọc theo user đang ở trạng thái ACTIVE và đã bật nhận thông báo
  const subscriptions = await prisma.pushSubscription.findMany({ 
    where: { 
      studioId,
      user: {
        status: "ACTIVE",
        notificationsEnabled: true
      }
    } 
  });

  await Promise.all(subscriptions.map(async (item) => {
    try {
      await webpush.sendNotification({
        endpoint: item.endpoint,
        keys: { p256dh: item.p256dh, auth: item.auth },
      }, JSON.stringify(payload));
    } catch (error) {
      const statusCode = (error as { statusCode?: number }).statusCode;
      if (statusCode === 404 || statusCode === 410) {
        await prisma.pushSubscription.delete({ where: { id: item.id } }).catch(() => null);
      }
    }
  }));
}
