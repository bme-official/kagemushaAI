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

  // 打ち合わせ意図の場合は deadline を先に収集してから連絡先フィールドを出す
  const isMeetingIntentFl = context?.inferredIntent
    ? ["日程調整", "打ち合わせ希望"].some((i) => context.inferredIntent!.includes(i))
    : false;
  const deadlineCollected = Boolean(collected.deadline);
  // 連絡先フィールド（name/email/org）を今出してよいか
  const identityFieldNames = ["name", "email", "organization", "phone"];
  const canShowIdentityNow = !isMeetingIntentFl || deadlineCollected;

  // AI が会話文脈から適切なフィールドを示唆している場合は優先する。
  // ただし shouldCollectContact が true かつ打ち合わせ意図なら deadline 収集後のみ連絡先を出す。
  const aiField = context?.aiSuggestedField;
  if (
    aiField &&
    aiField.fieldName !== "confirmSubmit" &&
    context?.shouldCollectContact &&
    (canShowIdentityNow || !identityFieldNames.includes(aiField.fieldName)) &&
    !collected[aiField.fieldName as keyof CollectedContactFields] &&
    !(isVoice && VOICE_ONLY_FIELDS.has(aiField.fieldName))
  ) {
    return aiField;
  }

  // 問い合わせ本文と意図が揃ってから連絡先情報を収集する。
  // 既にひとつでも連絡先フィールドが収集済みの場合は inferredIntent・shouldCollectContact
  // に関わらず継続する（フィールド送信ターンで条件が外れても途切れないようにする）。
  // 打ち合わせ意図の場合は deadline が収集されるまで連絡先を出さない。
  const alreadyCollecting = Boolean(
    collected.name || collected.email || collected.organization
  );
  const canAskIdentityFields =
    (alreadyCollecting && canShowIdentityNow) ||
    Boolean(
      collected.inquiryBody &&
      context?.inferredIntent &&
      context?.shouldCollectContact &&
      canShowIdentityNow
    );
  if (!canAskIdentityFields) return null;

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
