import { companyConfig } from "@/config/company.config";
import { inquiryConfig } from "@/config/inquiry.config";

type ClassificationInput = {
  userText: string;
};

export const classifyInquiry = ({ userText }: ClassificationInput) => {
  const text = userText.toLowerCase();

  const inferredIntent =
    inquiryConfig.inquiryIntents.find((intent) =>
      text.includes(intent.replace("相談", "").toLowerCase())
    ) ?? null;

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
