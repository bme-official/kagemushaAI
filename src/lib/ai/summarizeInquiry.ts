import type { ChatSessionState } from "@/types/chat";

export const summarizeInquiry = (session: ChatSessionState): string => {
  const fields = session.collectedFields;
  const parts = [
    `問い合わせ種別: ${session.inferredIntent ?? "未確定"}`,
    `想定事業カテゴリ: ${session.inferredCategory ?? "未確定"}`,
    `緊急度: ${session.urgency}`,
    `人間対応推奨: ${session.needsHuman ? "はい" : "いいえ"}`,
    `ご相談概要: ${fields.inquiryBody ?? "未入力"}`,
    `担当者名: ${fields.name ?? "未入力"}`,
    `メール: ${fields.email ?? "未入力"}`,
    `組織名: ${fields.organization ?? "未入力"}`,
    `電話番号: ${fields.phone ?? "未入力"}`,
    `予算感: ${fields.budget ?? "未入力"}`,
    `納期感: ${fields.deadline ?? "未入力"}`
  ];
  return parts.join("\n");
};
