import { NextRequest, NextResponse } from "next/server";
import { characterConfig } from "@/config/character.config";
import { inquiryConfig } from "@/config/inquiry.config";
import { uiConfig } from "@/config/ui.config";
import { buildChatMessages } from "@/lib/ai/buildChatMessages";
import { buildSystemPrompt } from "@/lib/ai/buildSystemPrompt";
import { classifyInquiry } from "@/lib/ai/classifyInquiry";
import { summarizeInquiry } from "@/lib/ai/summarizeInquiry";
import { getNextFieldRequest } from "@/lib/inquiry/fieldFlow";
import { isValidEmail, isValidPhone } from "@/lib/validation/contact";
import { getInMemoryAvatarSettings } from "@/lib/avatar/runtimeSettingsStore";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  ChatAgentResult,
  ChatApiRequest,
  ChatSessionState,
  CollectedContactFields,
  ConversationMessage,
  StructuredFieldRequest
} from "@/types/chat";

/** Supabase またはインメモリストアから最新の設定を取得する */
const fetchServerAvatarSettings = async (): Promise<ChatApiRequest["avatarSettings"] | null> => {
  try {
    const supabase = createSupabaseServerClient();
    if (supabase) {
      const { data } = await supabase
        .from("avatar_settings")
        .select("settings")
        .eq("id", "default")
        .maybeSingle();
      if (data?.settings) return data.settings as ChatApiRequest["avatarSettings"];
    }
  } catch { /* ignore */ }
  return getInMemoryAvatarSettings() as ChatApiRequest["avatarSettings"] | null;
};

const pushMessage = (
  messages: ConversationMessage[],
  message: Omit<ConversationMessage, "id" | "createdAt">
): ConversationMessage[] => {
  return [
    ...messages,
    {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      ...message
    }
  ];
};

const callOpenAI = async (
  session: ChatSessionState,
  userInput?: string,
  avatarSettings?: ChatApiRequest["avatarSettings"]
): Promise<ChatAgentResult | null> => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const messages = buildChatMessages(session, userInput);

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
      messages: [
        { role: "system", content: buildSystemPrompt(avatarSettings) },
        ...messages.map((m) => ({ role: m.role, content: m.content }))
      ],
      temperature: 0.4
    })
  });

  if (!response.ok) return null;
  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) return null;

  try {
    // GPT がマークダウンや前後テキスト付きで返す場合を吸収する:
    // 1) コードブロック除去 2) 最初の {...} を抽出 3) 直接 parse
    const stripped = content
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/i, "")
      .trim();
    // 直接 parse を試みる
    try {
      return JSON.parse(stripped) as ChatAgentResult;
    } catch {
      // テキストが混入している場合は最初の {...} ブロックを取り出す
      const match = stripped.match(/\{[\s\S]*\}/);
      if (match) return JSON.parse(match[0]) as ChatAgentResult;
      return null;
    }
  } catch {
    return null;
  }
};

const buildFallbackReply = (
  inputText: string | undefined,
  collected: CollectedContactFields,
  nextFieldRequest: StructuredFieldRequest | null
) => {
  if (!inputText && nextFieldRequest?.fieldName === "confirmSubmit") {
    // 収集済み内容を自然な文章でまとめて表示する
    const lines: string[] = [];
    if (collected.name) lines.push(`お名前：${collected.name}`);
    if (collected.organization) lines.push(`会社名：${collected.organization}`);
    if (collected.email) lines.push(`メール：${collected.email}`);
    if (collected.phone) lines.push(`電話番号：${collected.phone}`);
    if (collected.inquiryBody) lines.push(`ご相談内容：${collected.inquiryBody}`);
    if (collected.deadline) lines.push(`希望日時：${collected.deadline}`);
    if (collected.budget) lines.push(`予算感：${collected.budget}`);
    const summary = lines.length ? `\n${lines.map((l) => `・${l}`).join("\n")}` : "";
    return `ありがとうございます。以下の内容でよろしければ送信してください。${summary}`;
  }
  if (!inputText && nextFieldRequest) {
    return `${nextFieldRequest.label}を教えていただけますか？`;
  }
  if (!inputText) return characterConfig.fallbackMessage;
  if (!collected.inquiryBody) {
    return "ありがとうございます。もう少し詳しくご相談内容を教えていただけますか？";
  }
  if (nextFieldRequest) {
    return `かしこまりました。では${nextFieldRequest.label}を教えていただけますか？`;
  }
  return "ありがとうございます。内容を確認いたします。";
};

const applyAvatarIdentityToReply = (
  text: string,
  avatarSettings?: ChatApiRequest["avatarSettings"]
) => {
  if (!avatarSettings) return text;
  const companyName = avatarSettings.companyName?.trim();
  const avatarName = avatarSettings.avatarName?.trim();
  const serviceName = avatarSettings.services?.find((item) => item.name?.trim())?.name?.trim();

  let next = text;
  if (companyName) {
    next = next.replaceAll("B'Me合同会社", companyName);
  }
  if (avatarName) {
    next = next.replaceAll(characterConfig.name, avatarName);
  }
  const hasMention = [companyName, avatarName, serviceName]
    .filter(Boolean)
    .some((token) => next.includes(token as string));
  if (!hasMention && /どのようなご相談ですか\??/.test(next)) {
    if (companyName && avatarName) {
      next = `どのようなご相談でしょうか？ ${companyName}の${avatarName}が丁寧にお伺いします。`;
    } else {
      next = "どのようなご相談でしょうか？ 丁寧にお伺いします。";
    }
  }
  return next;
};

export async function POST(request: NextRequest) {
  const body = (await request.json()) as ChatApiRequest;
  const session = body.session;
  const workingSession: ChatSessionState = {
    ...session,
    collectedFields: { ...session.collectedFields }
  };

  // サーバーの最新設定をクライアント送信設定より優先（Supabase → インメモリ → クライアント送信の順）。
  // ただし services / kana などがサーバー側で空の場合はクライアント送信値を保持する。
  const serverSettings = await fetchServerAvatarSettings();
  const clientSettings = body.avatarSettings ?? {};
  const effectiveAvatarSettings: ChatApiRequest["avatarSettings"] = serverSettings
    ? {
        ...clientSettings,
        ...serverSettings,
        // サーバーに services が未設定ならクライアント側の services を使う
        services: serverSettings.services?.length
          ? serverSettings.services
          : (clientSettings.services?.length ? clientSettings.services : serverSettings.services),
        // kana はどちらかがあれば優先する
        avatarNameKana: serverSettings.avatarNameKana || clientSettings.avatarNameKana,
        companyNameKana: serverSettings.companyNameKana || clientSettings.companyNameKana
      }
    : (clientSettings as ChatApiRequest["avatarSettings"] | undefined);

  let userText: string | undefined;
  if (body.userInput) {
    userText = body.userInput.trim();
    if (userText) {
      workingSession.messages = pushMessage(workingSession.messages, {
        role: "user",
        kind: "text",
        content: userText
      });
      // 3文字以上の発話は inquiryBody の候補として記録する。
      // 「打ち合わせしよう」(8文字)等の短い意図表明もカバーするため閾値を引き下げ。
      if (!workingSession.collectedFields.inquiryBody && userText.length >= 3) {
        workingSession.collectedFields.inquiryBody = userText;
      }
    }
  }

  if (body.fieldResponse) {
    const { fieldName, value } = body.fieldResponse;
    const trimmed = value.trim();
    if (fieldName === "email" && trimmed && !isValidEmail(trimmed)) {
      return NextResponse.json(
        {
          error: "invalid_email",
          message: "メールアドレス形式が正しくありません。"
        },
        { status: 400 }
      );
    }
    if (fieldName === "phone" && trimmed && !isValidPhone(trimmed)) {
      return NextResponse.json(
        {
          error: "invalid_phone",
          message: "電話番号形式が正しくありません。"
        },
        { status: 400 }
      );
    }

    if (fieldName !== "confirmSubmit") {
      workingSession.collectedFields[fieldName] = trimmed;
      workingSession.messages = pushMessage(workingSession.messages, {
        role: "user",
        kind: "text",
        content: `${fieldName}: ${trimmed || "(空欄)"}`
      });
    }
  }

  const latestText = body.userInput || body.fieldResponse?.value || "";
  const inputMode = body.inputMode ?? "text";
  const shouldCollectContact =
    workingSession.phase === "confirming" ||
    /送信|保存|この内容|以上|確定|提出|登録/.test(latestText);
  const resultFromRule = classifyInquiry({ userText: latestText });
  workingSession.inferredIntent = workingSession.inferredIntent ?? resultFromRule.inferredIntent;
  workingSession.inferredCategory =
    workingSession.inferredCategory ?? resultFromRule.inferredCategory;
  workingSession.urgency = resultFromRule.urgency;
  workingSession.needsHuman = resultFromRule.needsHuman;

  const aiResult = await callOpenAI(workingSession, userText, effectiveAvatarSettings);
  if (aiResult) {
    // inferredIntent / inferredCategory は AI が null を返した場合でも前ターンの値を保持する。
    // フィールド送信ターン（userText 未定義）で AI が分類不能でも収集フローが途切れないようにする。
    workingSession.inferredCategory = aiResult.inferredCategory ?? workingSession.inferredCategory;
    workingSession.inferredIntent = aiResult.inferredIntent ?? workingSession.inferredIntent;
    workingSession.urgency = aiResult.urgency;
    workingSession.needsHuman = aiResult.needsHuman;
    // AI が null を返してもすでに収集済みのフィールドを上書きしない。
    // AI が "明日の夕方はどうですか" 等を inquiryBody に入れてくることがあるが、
    // null / 空文字で既存値を消さないようにする。
    const aiCollected = aiResult.collectedFields as Record<string, unknown> | null;
    if (aiCollected) {
      for (const [key, val] of Object.entries(aiCollected)) {
        if (val !== null && val !== undefined && val !== "") {
          (workingSession.collectedFields as Record<string, unknown>)[key] = val;
        }
      }
    }
  }

  // AI が inferredIntent を確定した後に shouldCollectContact を再評価する。
  // ユーザーが「送信」などを言わなくても、相談内容と意図が揃えば連絡先収集を開始する。
  // また AI が nextFieldRequest を返している場合も収集フェーズと判断する（短い発話でも対応）。
  // さらに name/email/organization のいずれかが既に収集済みなら無条件で継続する。
  const contactFieldsStarted = Boolean(
    workingSession.collectedFields.name ||
    workingSession.collectedFields.email ||
    workingSession.collectedFields.organization
  );
  const finalShouldCollectContact =
    shouldCollectContact ||
    Boolean(workingSession.collectedFields.inquiryBody && workingSession.inferredIntent) ||
    Boolean(workingSession.collectedFields.inquiryBody && aiResult?.nextFieldRequest) ||
    contactFieldsStarted;

  const nextFieldRequest = getNextFieldRequest(workingSession.collectedFields, {
    inferredIntent: workingSession.inferredIntent,
    shouldCollectContact: finalShouldCollectContact,
    inputMode,
    // AI が会話文脈から示唆したフィールドをヒントとして渡す（会話とフォームの同期）
    aiSuggestedField: aiResult?.nextFieldRequest ?? null
  });
  const hasRequired = inquiryConfig.requiredFieldsForSubmit.every((field) =>
    Boolean(workingSession.collectedFields[field])
  );

  // 必須項目が揃ったら任意フィールドの示唆を無視して必ず確認フェーズへ移行する。
  // AI が phone などの任意フィールドを nextFieldRequest で返しても
  // getNextFieldRequest がそれを返してしまい !nextFieldRequest が偽になる問題を防ぐ。
  if (hasRequired && finalShouldCollectContact) {
    workingSession.phase = "confirming";
    workingSession.summaryDraft = summarizeInquiry(workingSession);
  } else {
    workingSession.phase = "collecting";
  }

  // confirming フェーズでは nextFieldRequest を confirmSubmit に上書きする。
  // 任意フィールドが残っていても確認画面を優先する。
  let finalNextFieldRequest = nextFieldRequest;
  if (workingSession.phase === "confirming") {
    finalNextFieldRequest = {
      kind: "field_request",
      fieldName: "confirmSubmit",
      inputType: "confirm",
      label: uiConfig.confirmPrompt,
      required: true
    };
  }

  // confirming フェーズは AI の返答を使わず自前の要約を必ず使う。
  // AI がフォールバックメッセージや混乱した返答をしても安定した確認文を表示する。
  const assistantTextRaw =
    workingSession.phase === "confirming"
      ? buildFallbackReply(undefined, workingSession.collectedFields, finalNextFieldRequest)
      : (aiResult?.reply ?? buildFallbackReply(userText, workingSession.collectedFields, finalNextFieldRequest));
  const assistantText = applyAvatarIdentityToReply(assistantTextRaw, effectiveAvatarSettings);

  const assistantMessage: ConversationMessage = {
    id: crypto.randomUUID(),
    role: "assistant",
    kind: "text",
    content: assistantText,
    createdAt: new Date().toISOString()
  };

  workingSession.messages = pushMessage(workingSession.messages, {
    role: "assistant",
    kind: "text",
    content: assistantText
  });

  return NextResponse.json({
    session: workingSession,
    assistantMessage,
    nextFieldRequest: finalNextFieldRequest
  });
}
