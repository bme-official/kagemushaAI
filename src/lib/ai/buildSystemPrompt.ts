import { characterConfig } from "@/config/character.config";
import { companyConfig } from "@/config/company.config";
import { inquiryConfig } from "@/config/inquiry.config";

type RuntimeAvatarSettings = {
  avatarName?: string;
  avatarNameKana?: string;
  avatarAge?: string;
  companyName?: string;
  companyNameKana?: string;
  profile?: string;
  services?: Array<{
    name: string;
    ruby: string;
    description: string;
  }>;
};

export const buildSystemPrompt = (runtimeAvatarSettings?: RuntimeAvatarSettings): string => {
  const runtimeName = runtimeAvatarSettings?.avatarName || characterConfig.name;
  const runtimeCompanyName = runtimeAvatarSettings?.companyName || companyConfig.name;
  const runtimeLines: string[] = [];
  if (runtimeAvatarSettings?.avatarName) {
    runtimeLines.push(`- 表示名: ${runtimeAvatarSettings.avatarName}`);
  }
  if (runtimeAvatarSettings?.avatarNameKana) {
    runtimeLines.push(`- 表示名(読み): ${runtimeAvatarSettings.avatarNameKana}`);
  }
  if (runtimeAvatarSettings?.avatarAge) {
    runtimeLines.push(`- 年齢: ${runtimeAvatarSettings.avatarAge}`);
  }
  if (runtimeAvatarSettings?.companyName) {
    runtimeLines.push(`- 企業名: ${runtimeAvatarSettings.companyName}`);
  }
  if (runtimeAvatarSettings?.companyNameKana) {
    runtimeLines.push(`- 企業名(読み): ${runtimeAvatarSettings.companyNameKana}`);
  }
  if (runtimeAvatarSettings?.profile) {
    runtimeLines.push(`- プロフィール: ${runtimeAvatarSettings.profile}`);
  }
  if (runtimeAvatarSettings?.services?.length) {
    runtimeLines.push("- サービス一覧:");
    runtimeAvatarSettings.services
      .filter((service) => service.name || service.description)
      .slice(0, 10)
      .forEach((service, index) => {
        runtimeLines.push(
          `  ${index + 1}. ${service.name || "名称未設定"} (${service.ruby || "読み未設定"}) - ${
            service.description || "説明未設定"
          }`
        );
      });
  }

  // 設定済みサービス一覧があればそれを優先。なければデフォルトの事業カテゴリを使う
  const configuredServices = runtimeAvatarSettings?.services?.filter((s) => s.name) ?? [];
  const serviceLines = configuredServices.length
    ? configuredServices.map((s) =>
        `  - ${s.name}${s.ruby ? `（${s.ruby}）` : ""}${s.description ? `: ${s.description}` : ""}`
      ).join("\n")
    : companyConfig.businessCategories.map((c) => `  - ${c}`).join("\n");

  // 説明文：設定済みサービスがある場合は services から生成し、description との矛盾を防ぐ
  const description = runtimeAvatarSettings?.profile
    ? runtimeAvatarSettings.profile
    : configuredServices.length
      ? `${runtimeCompanyName}では${configuredServices.map((s) => s.name).join("、")}を提供しています。`
      : companyConfig.description;

  return `
あなたは${runtimeCompanyName}の問い合わせサポートキャラクター「${runtimeName}」です。
役割: ${characterConfig.role.replace(companyConfig.name, runtimeCompanyName)}
口調: ${characterConfig.tone}
一人称: ${characterConfig.firstPerson}
ユーザー呼称: ${characterConfig.userCallName}

話し方ガイド:
${characterConfig.speakingStyle.map((s) => `- ${s}`).join("\n")}

禁止表現:
${characterConfig.forbiddenStyle.map((s) => `- ${s}`).join("\n")}

企業情報:
- 会社名: ${runtimeCompanyName}
- 説明: ${description}
- 提供サービス・事業（「サービスを教えて」「何ができる？」などの質問には必ず以下に記載された内容だけで答え、ここに無いサービスは絶対に言及しない）:
${serviceLines}

【重要】上記「提供サービス・事業」の一覧が唯一の正確なサービス情報です。他の情報源と矛盾する場合は「提供サービス・事業」の内容を優先してください。

アバター設定(ユーザー編集内容):
${runtimeLines.length ? runtimeLines.join("\n") : "- 未設定(デフォルト設定で応答)"}

問い合わせ種別候補:
${inquiryConfig.inquiryIntents.map((intent) => `- ${intent}`).join("\n")}

応答ポリシー:
- 丁寧で親しみやすく短めに回答する
- まず相談内容を整理し、不明点は確認する
- 契約確約や法的判断はしない
- 個人情報は必要最小限のみ確認する
- 最後に要約と送信確認を行う
- 初回の挨拶と最初の数回の返答では、可能な範囲で会社名・担当名・主要サービス名を自然に含める
- サービスや事業内容について聞かれた場合は「提供サービス・事業」に記載された内容のみを案内する

必ず次のJSON形式のみで返してください:
{
  "reply": "string",
  "inferredCategory": "string | null",
  "inferredIntent": "string | null",
  "urgency": "low | medium | high",
  "needsHuman": "boolean",
  "nextFieldRequest": {
    "fieldName": "organization | name | email | phone | inquiryBody | budget | deadline | confirmSubmit",
    "inputType": "text | email | tel | textarea | select | confirm",
    "label": "string",
    "required": "boolean",
    "placeholder": "string"
  } | null,
  "collectedFields": {
    "organization": "string?",
    "name": "string?",
    "email": "string?",
    "phone": "string?",
    "inquiryBody": "string?",
    "budget": "string?",
    "deadline": "string?"
  },
  "summaryDraft": "string"
}
`.trim();
};
