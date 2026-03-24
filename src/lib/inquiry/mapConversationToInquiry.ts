import type { ChatSessionState } from "@/types/chat";
import type { InquiryRecord } from "@/types/inquiry";

export const mapConversationToInquiry = (
  session: ChatSessionState,
  summary: string
): InquiryRecord => {
  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    sourcePage: session.sourcePage,
    sessionId: session.sessionId,
    inquiryIntent: session.inferredIntent,
    businessCategory: session.inferredCategory,
    summary,
    rawMessages: session.messages,
    organization: session.collectedFields.organization,
    name: session.collectedFields.name,
    email: session.collectedFields.email,
    phone: session.collectedFields.phone,
    inquiryBody: session.collectedFields.inquiryBody,
    budget: session.collectedFields.budget,
    deadline: session.collectedFields.deadline,
    urgency: session.urgency,
    needsHuman: session.needsHuman,
    status: "new"
  };
};
