import type { CollectedContactFields, ConversationMessage } from "@/types/chat";

export type InquiryCategory = string;

export type InquiryIntent = string;

export type InquiryStatus = "new" | "reviewing" | "closed";

export type InquiryRecord = {
  id: string;
  createdAt: string;
  sourcePage: string;
  sessionId: string;
  inquiryIntent: InquiryIntent | null;
  businessCategory: InquiryCategory | null;
  summary: string;
  rawMessages: ConversationMessage[];
  organization?: string;
  name?: string;
  email?: string;
  phone?: string;
  inquiryBody?: string;
  budget?: string;
  deadline?: string;
  urgency: "low" | "medium" | "high";
  needsHuman: boolean;
  status: InquiryStatus;
};

export type NotificationPayload = {
  inquiry: InquiryRecord;
  collectedFields: CollectedContactFields;
  botMemo: string;
};
