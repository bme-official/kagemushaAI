import { inquiryConfig } from "@/config/inquiry.config";
import type { CollectedContactFields, StructuredFieldRequest } from "@/types/chat";

const VOICE_ONLY_FIELDS = new Set(
  inquiryConfig.fieldCollection.filter((f) => f.voiceOnly).map((f) => f.fieldName)
);

export const getNextFieldRequest = (
  collected: CollectedContactFields,
  context?: {
    inferredIntent?: string | null;
    shouldCollectContact?: boolean;
    inputMode?: "voice" | "text";
    /** AI が JSON で返した nextFieldRequest を会話流れのヒントとして利用 */
    aiSuggestedField?: StructuredFieldRequest | null;
  }
): StructuredFieldRequest | null => {
  const isVoice = context?.inputMode === "voice";

  // ボイスモードでは voiceOnly フィールドのフォーム表示をスキップ。
  // when_missing かつ voiceOnly のフィールドは会話で収集するため表示しない。
  for (const field of inquiryConfig.fieldCollection) {
    const value = collected[field.fieldName as keyof CollectedContactFields];
    if (isVoice && VOICE_ONLY_FIELDS.has(field.fieldName)) continue;
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

  // 問い合わせ本文と意図が揃ってから連絡先情報を収集する。
  // 既にひとつでも連絡先フィールドが収集済みの場合は inferredIntent・shouldCollectContact
  // に関わらず継続する（フィールド送信ターンで条件が外れても途切れないようにする）。
  const alreadyCollecting = Boolean(
    collected.name || collected.email || collected.organization
  );
  const canAskIdentityFields =
    alreadyCollecting ||
    Boolean(
      collected.inquiryBody &&
      context?.inferredIntent &&
      context?.shouldCollectContact
    );
  if (!canAskIdentityFields) return null;

  // AI が会話文脈から適切なフィールドを示唆している場合はそれを優先する。
  // ただし既に収集済みのフィールドは除外し、voiceOnly フィールドはボイスモードでスキップ。
  const aiField = context?.aiSuggestedField;
  if (
    aiField &&
    aiField.fieldName !== "confirmSubmit" &&
    !collected[aiField.fieldName as keyof CollectedContactFields] &&
    !(isVoice && VOICE_ONLY_FIELDS.has(aiField.fieldName))
  ) {
    return aiField;
  }

  // AI 示唆がない・使えない場合は固定順序で次の未収集フィールドを返す。
  for (const field of inquiryConfig.fieldCollection) {
    const value = collected[field.fieldName as keyof CollectedContactFields];
    if (isVoice && VOICE_ONLY_FIELDS.has(field.fieldName)) continue;
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
