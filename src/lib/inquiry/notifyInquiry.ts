import type { NotificationPayload } from "@/types/inquiry";
import { notificationConfig } from "@/config/notification.config";

type InquiryNotifier = {
  name: string;
  send: (payload: NotificationPayload) => Promise<void>;
};

const buildEmailHtml = (payload: NotificationPayload): string => {
  const { inquiry, collectedFields } = payload;
  const rows = [
    ["受付日時", new Date(inquiry.createdAt).toLocaleString("ja-JP")],
    ["会社名", collectedFields.organization ?? "—"],
    ["担当者名", collectedFields.name ?? "—"],
    ["メールアドレス", collectedFields.email ?? "—"],
    ["電話番号", collectedFields.phone ?? "—"],
    ["相談内容", collectedFields.inquiryBody ?? "—"],
    ["予算感", collectedFields.budget ?? "—"],
    ["希望日時", collectedFields.deadline ?? "—"],
    ["緊急度", inquiry.urgency],
    ["人対応必要", inquiry.needsHuman ? "はい" : "いいえ"],
    ["カテゴリ", inquiry.businessCategory ?? "—"],
    ["インテント", inquiry.inquiryIntent ?? "—"],
    ["要約", inquiry.summary]
  ];
  const tableRows = rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:6px 12px;font-weight:600;white-space:nowrap;vertical-align:top;background:#f8fafc;">${label}</td><td style="padding:6px 12px;">${String(value).replace(/\n/g, "<br>")}</td></tr>`
    )
    .join("");
  return `
<div style="font-family:sans-serif;max-width:640px;margin:0 auto;">
  <h2 style="background:#0f172a;color:#fff;padding:16px 20px;border-radius:8px 8px 0 0;margin:0;">
    新しいお問い合わせが届きました
  </h2>
  <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;">
    ${tableRows}
  </table>
  <p style="font-size:12px;color:#64748b;margin-top:12px;">
    このメールは AIコンシェルジュ から自動送信されています。
  </p>
</div>`;
};

const resendNotifier: InquiryNotifier = {
  name: "resend",
  async send(payload) {
    const { resendApiKey, notificationToEmail, notificationFromEmail } = notificationConfig;
    if (!resendApiKey || !notificationToEmail) {
      console.warn("[notify] RESEND_API_KEY または NOTIFICATION_TO_EMAIL が未設定です");
      return;
    }
    const subject = `【お問い合わせ】${payload.collectedFields.organization ?? "匿名"} 様より（緊急度: ${payload.inquiry.urgency}）`;
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendApiKey}`
      },
      body: JSON.stringify({
        from: notificationFromEmail,
        to: [notificationToEmail],
        subject,
        html: buildEmailHtml(payload)
      })
    });
    if (!res.ok) {
      const err = await res.text();
      console.error("[notify] Resend 送信失敗:", err);
    }
  }
};

const consoleNotifier: InquiryNotifier = {
  name: "console",
  async send(payload) {
    console.info("[inquiry notification]", {
      destination: notificationConfig.destinationLabel,
      id: payload.inquiry.id,
      urgency: payload.inquiry.urgency,
      needsHuman: payload.inquiry.needsHuman,
      summary: payload.inquiry.summary
    });
  }
};

const supabaseOnlyNotifier: InquiryNotifier = {
  name: "supabase_only",
  async send() {
    // DB保存のみ・メール通知なし
  }
};

const selectNotifier = (): InquiryNotifier => {
  if (notificationConfig.provider === "resend") return resendNotifier;
  if (notificationConfig.provider === "supabase_only") return supabaseOnlyNotifier;
  return consoleNotifier;
};

export const notifyInquiry = async (payload: NotificationPayload) => {
  await selectNotifier().send(payload);
};
