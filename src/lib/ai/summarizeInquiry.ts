import type { ChatSessionState } from "@/types/chat";

export const summarizeInquiry = (session: ChatSessionState): string => {
  const fields = session.collectedFields;
  // 入力済み項目のみ表示。未入力の任意項目は含めない。
  const parts: string[] = [
    session.inferredIntent ? `問い合わせ種別: ${session.inferredIntent}` : null,
    fields.inquiryBody ? `ご相談概要: ${fields.inquiryBody}` : null,
    fields.name ? `担当者名: ${fields.name}` : null,
    fields.email ? `メール: ${fields.email}` : null,
    fields.organization ? `組織名: ${fields.organization}` : null,
    fields.phone ? `電話番号: ${fields.phone}` : null,
    fields.deadline ? `希望日時: ${fields.deadline}` : null,
    fields.budget ? `予算感: ${fields.budget}` : null
  ].filter((v): v is string => v !== null);
  return parts.join("\n");
};
