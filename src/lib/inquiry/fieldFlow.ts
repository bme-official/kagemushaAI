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

  // 連絡先収集の開始条件:
  // 1) shouldCollectContact=true になれば inquiryBody 未収集でも即座に開始する
  //    （「問い合わせしたいです」等の汎用意図で詳細確認前に収集を始められるようにする）
  // 2) すでに1フィールドでも収集済みなら無条件で継続する
  // 3) 打ち合わせ意図の場合は deadline 収集後のみ連絡先を出す
  const alreadyCollecting = Boolean(
    collected.name || collected.email || collected.organization
  );
  const canAskIdentityFields =
    (alreadyCollecting && canShowIdentityNow) ||
    Boolean(context?.shouldCollectContact && canShowIdentityNow);
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
