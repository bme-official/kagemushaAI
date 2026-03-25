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
    return JSON.parse(content) as ChatAgentResult;
  } catch {
    return null;
  }
};

const buildFallbackReply = (
  inputText: string | undefined,
  collected: CollectedContactFields,
  nextFieldRequest: StructuredFieldRequest | null
) => {
  if (!inputText && nextFieldRequest) {
    return `${nextFieldRequest.label}を入力してください。`;
  }
  if (!inputText) return characterConfig.fallbackMessage;
  if (!collected.inquiryBody) {
    return "ありがとうございます。ご相談の概要をもう少し詳しく教えてください。";
  }
  return `ありがとうございます。内容を整理しました。${nextFieldRequest ? `${nextFieldRequest.label}を続けて入力してください。` : "送信内容の確認へ進みます。"}`;
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

  // サーバーの最新設定をクライアント送信設定より優先（Supabase → インメモリ → クライアント送信の順）
  const serverSettings = await fetchServerAvatarSettings();
  const effectiveAvatarSettings: ChatApiRequest["avatarSettings"] = serverSettings
    ? { ...(body.avatarSettings ?? {}), ...serverSettings }
    : (body.avatarSettings ?? undefined);

  let userText: string | undefined;
  if (body.userInput) {
    userText = body.userInput.trim();
    if (userText) {
      workingSession.messages = pushMessage(workingSession.messages, {
        role: "user",
        kind: "text",
        content: userText
      });
      if (!workingSession.collectedFields.inquiryBody && userText.length >= 10) {
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
    workingSession.inferredCategory = aiResult.inferredCategory;
    workingSession.inferredIntent = aiResult.inferredIntent;
    workingSession.urgency = aiResult.urgency;
    workingSession.needsHuman = aiResult.needsHuman;
    workingSession.collectedFields = {
      ...workingSession.collectedFields,
      ...aiResult.collectedFields
    };
  }

  const nextFieldRequest = getNextFieldRequest(workingSession.collectedFields, {
    inferredIntent: workingSession.inferredIntent,
    shouldCollectContact,
    inputMode
  });
  const hasRequired = inquiryConfig.requiredFieldsForSubmit.every((field) =>
    Boolean(workingSession.collectedFields[field])
  );

  if (!nextFieldRequest && hasRequired && shouldCollectContact) {
    workingSession.phase = "confirming";
    workingSession.summaryDraft = summarizeInquiry(workingSession);
  } else {
    workingSession.phase = "collecting";
  }

  const assistantTextRaw =
    aiResult?.reply ??
    buildFallbackReply(userText, workingSession.collectedFields, nextFieldRequest);
  const assistantText = applyAvatarIdentityToReply(assistantTextRaw, effectiveAvatarSettings);

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
