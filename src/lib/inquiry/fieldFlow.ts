import { inquiryConfig } from "@/config/inquiry.config";
import type { CollectedContactFields, StructuredFieldRequest } from "@/types/chat";

export const getNextFieldRequest = (
  collected: CollectedContactFields
): StructuredFieldRequest | null => {
  // 会話文脈のない必須情報の押し付けを避けるため、
  // まず問い合わせ本文の補足（when_missing）を優先して確認する。
  for (const field of inquiryConfig.fieldCollection) {
    const value = collected[field.fieldName];
    if (field.required && field.showTiming === "when_missing" && !value) {
      return {
        kind: "field_request",
        fieldName: field.fieldName,
        inputType: field.inputType,
        label: field.label,
        required: field.required,
        placeholder: field.placeholder
      };
    }
  }

  // 問い合わせ本文が揃ってから、送信に必要な必須項目のみ収集する。
  for (const field of inquiryConfig.fieldCollection) {
    const value = collected[field.fieldName];
    if (field.required && field.showTiming !== "when_missing" && !value) {
      return {
        kind: "field_request",
        fieldName: field.fieldName,
        inputType: field.inputType,
        label: field.label,
        required: field.required,
        placeholder: field.placeholder
      };
    }
  }

  return null;
};
