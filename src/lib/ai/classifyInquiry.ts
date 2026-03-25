import { companyConfig } from "@/config/company.config";
import { inquiryConfig } from "@/config/inquiry.config";

type ClassificationInput = {
  userText: string;
};

/** インテント名に直接マッチしないキーワードの別名マッピング */
const INTENT_KEYWORD_ALIASES: Record<string, string[]> = {
  日程調整: ["打ち合わせ", "ミーティング", "mtg", "面談", "商談", "会議", "日程", "スケジュール", "アポ", "訪問"],
  制作相談: ["制作", "作成", "開発", "デザイン", "サイト", "web", "ウェブ", "アプリ", "lp"],
  見積もり相談: ["見積", "費用", "料金", "いくら", "コスト", "予算"],
  導入相談: ["導入", "採用", "検討", "利用したい", "使いたい", "試したい"],
  業務提携: ["提携", "協業", "パートナー", "コラボ"],
  資料請求: ["資料", "パンフ", "カタログ"]
};

export const classifyInquiry = ({ userText }: ClassificationInput) => {
  const text = userText.toLowerCase();

  // まずエイリアスキーワードで判定し、次にインテント名直接マッチにフォールバック
  const inferredIntent =
    (Object.entries(INTENT_KEYWORD_ALIASES).find(([, keywords]) =>
      keywords.some((kw) => text.includes(kw))
    )?.[0] ?? null) ||
    (inquiryConfig.inquiryIntents.find((intent) =>
      text.includes(intent.replace("相談", "").toLowerCase())
    ) ?? null);

  const inferredCategory =
    companyConfig.businessCategories.find((category) =>
      text.includes(category.toLowerCase())
    ) ?? null;

  const urgency = inquiryConfig.urgencyRules.highKeywords.some((k) =>
    text.includes(k.toLowerCase())
  )
    ? "high"
    : inquiryConfig.urgencyRules.mediumKeywords.some((k) =>
          text.includes(k.toLowerCase())
        )
      ? "medium"
      : "low";

  const needsHuman =
    (urgency === "high" && inquiryConfig.humanHandoffConditions.highUrgency) ||
    inquiryConfig.humanHandoffConditions.keywords.some((k) =>
      text.includes(k.toLowerCase())
    );

  return {
    inferredIntent,
    inferredCategory,
    urgency: urgency as "low" | "medium" | "high",
    needsHuman
  };
};
