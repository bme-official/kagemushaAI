import type { StructuredInputType } from "@/types/chat";

export type InquiryFieldConfig = {
  fieldName:
    | "organization"
    | "name"
    | "email"
    | "phone"
    | "inquiryBody"
    | "budget"
    | "deadline";
  inputType: StructuredInputType;
  label: string;
  placeholder: string;
  required: boolean;
  showTiming:
    | "after_greeting"
    | "after_intent_guess"
    | "before_confirm"
    | "when_missing";
};

export const inquiryConfig = {
  inquiryIntents: [
    "制作相談",
    "見積もり相談",
    "業務提携",
    "サービスに関する質問",
    "資料請求",
    "その他"
  ],
  requiredFieldsForSubmit: ["name", "email", "inquiryBody"] as const,
  humanHandoffConditions: {
    highUrgency: true,
    keywords: ["緊急", "炎上", "法務", "クレーム", "契約トラブル"]
  },
  urgencyRules: {
    highKeywords: ["至急", "今日中", "今すぐ", "緊急"],
    mediumKeywords: ["今週", "早め", "なるべく早く"]
  },
  summaryRules: {
    includeRawSummary: true,
    maxLength: 500
  },
  fieldCollection: [
    {
      fieldName: "name",
      inputType: "text",
      label: "担当者名",
      placeholder: "例) 山田 太郎",
      required: true,
      showTiming: "after_intent_guess"
    },
    {
      fieldName: "email",
      inputType: "email",
      label: "メールアドレス",
      placeholder: "example@company.com",
      required: true,
      showTiming: "after_intent_guess"
    },
    {
      fieldName: "organization",
      inputType: "text",
      label: "組織・団体名",
      placeholder: "任意（個人の方は空欄可）",
      required: false,
      showTiming: "before_confirm"
    },
    {
      fieldName: "phone",
      inputType: "tel",
      label: "電話番号",
      placeholder: "09012345678",
      required: false,
      showTiming: "before_confirm"
    },
    {
      fieldName: "inquiryBody",
      inputType: "textarea",
      label: "お問い合わせ内容の補足",
      placeholder: "ご希望内容、背景、困りごとなど",
      required: true,
      showTiming: "when_missing"
    },
    {
      fieldName: "budget",
      inputType: "text",
      label: "予算感",
      placeholder: "例) 30万円前後",
      required: false,
      showTiming: "before_confirm"
    },
    {
      fieldName: "deadline",
      inputType: "text",
      label: "納期感",
      placeholder: "例) 2か月以内",
      required: false,
      showTiming: "before_confirm"
    }
  ] satisfies InquiryFieldConfig[]
};
