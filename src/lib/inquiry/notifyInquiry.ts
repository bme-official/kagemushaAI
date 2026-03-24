import type { NotificationPayload } from "@/types/inquiry";
import { notificationConfig } from "@/config/notification.config";

type InquiryNotifier = {
  name: string;
  send: (payload: NotificationPayload) => Promise<void>;
};

const consoleNotifier: InquiryNotifier = {
  name: "console",
  async send(payload) {
    console.info("[inquiry notification]", {
      destination: notificationConfig.destinationLabel,
      id: payload.inquiry.id,
      urgency: payload.inquiry.urgency,
      needsHuman: payload.inquiry.needsHuman,
      summary: payload.inquiry.summary,
      rawMessages: notificationConfig.includeConversationLog
        ? payload.inquiry.rawMessages
        : "[hidden by config]"
    });
  }
};

const supabaseOnlyNotifier: InquiryNotifier = {
  name: "supabase_only",
  async send() {
    // NOTE: DB保存だけで通知を行わないモード
  }
};

// TODO: 将来は SlackNotifier / MailNotifier を追加し config で切替える
const activeNotifier: InquiryNotifier =
  notificationConfig.provider === "supabase_only"
    ? supabaseOnlyNotifier
    : consoleNotifier;

export const notifyInquiry = async (payload: NotificationPayload) => {
  await activeNotifier.send(payload);
};
