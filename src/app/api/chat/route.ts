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
  return "ありがとうございます。もう少し詳しくお聞かせください。打ち合わせをご希望の場合は、ご希望日時もあわせて教えてください。";
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

  // 問い合わせ送信完了後にユーザーが新たな会話を始めた場合は、
  // 問い合わせ内容をリセットして新しい相談として扱う。
  // 連絡先情報（name/email/org/phone）は保持し再利用できるようにする。
  // 表示用メッセージ履歴は保持するが、AI には受付完了メッセージ＋新規入力のみ渡す。
  let wasCompletedPhase = false;
  if (workingSession.phase === "completed" && body.userInput) {
    wasCompletedPhase = true;
    workingSession.phase = "collecting";
    const { name, email, organization, phone } = workingSession.collectedFields;
    workingSession.collectedFields = { name, email, organization, phone };
    workingSession.inferredIntent = null;
    workingSession.inferredCategory = null;
    workingSession.summaryDraft = "";
    // 表示用メッセージはフォーム入力行のみ除去して保持（ユーザーが履歴を見返せる）
    workingSession.messages = workingSession.messages.filter((m) => {
      if (m.role !== "user") return true;
      const content = typeof m.content === "string" ? m.content : "";
      return !/^(name|email|organization|phone|inquiryBody|deadline|budget):\s/.test(content);
    });
  }

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
  const resultFromRule = classifyInquiry({ userText: latestText });
  const shouldCollectContact =
    workingSession.phase === "confirming" ||
    /送信|保存|この内容|以上|確定|提出|登録/.test(latestText) ||
    resultFromRule.shouldCollectContact;
  workingSession.inferredIntent = workingSession.inferredIntent ?? resultFromRule.inferredIntent;
  workingSession.inferredCategory =
    workingSession.inferredCategory ?? resultFromRule.inferredCategory;
  workingSession.urgency = resultFromRule.urgency;
  workingSession.needsHuman = resultFromRule.needsHuman;

  // confirming フェーズで「修正したい」などの意図を検出した場合は collecting に戻す
  const wantsToEdit = workingSession.phase === "confirming" &&
    /修正|変更|直し|訂正|間違|やり直|edit/.test(latestText ?? "");
  if (wantsToEdit) {
    workingSession.phase = "collecting";
    // テキストからどのフィールドを修正するか推定してクリア
    const fieldClearPatterns: [keyof CollectedContactFields, RegExp][] = [
      ["email", /メール|アドレス|mail/i],
      ["name", /名前|お名前|氏名/i],
      ["organization", /会社|組織|社名/i],
      ["phone", /電話/i],
      ["deadline", /日程|日時|スケジュール/i],
      ["budget", /予算|費用/i],
    ];
    for (const [field, pattern] of fieldClearPatterns) {
      if (pattern.test(latestText ?? "")) {
        delete workingSession.collectedFields[field];
        break;
      }
    }
  }

  // 完了後の新規会話では、AI に渡すメッセージを受付完了メッセージ＋新規入力のみに絞る。
  // 表示用メッセージ（workingSession.messages）は保持し、AI コンテキストのみ切り分ける。
  const sessionForAI = wasCompletedPhase
    ? (() => {
        const lastAssistant = [...workingSession.messages].reverse().find((m) => m.role === "assistant");
        const lastUser = workingSession.messages[workingSession.messages.length - 1];
        return {
          ...workingSession,
          messages: [
            ...(lastAssistant ? [lastAssistant] : []),
            ...(lastUser?.role === "user" ? [lastUser] : [])
          ]
        };
      })()
    : workingSession;

  const aiResult = await callOpenAI(sessionForAI, userText, effectiveAvatarSettings);
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

  const MEETING_INTENTS = ["日程調整", "打ち合わせ希望"];
  const isMeetingIntent = MEETING_INTENTS.some(
    (intent) => workingSession.inferredIntent?.includes(intent)
  );
  // 打ち合わせ意図で日時らしき発話があれば deadline を補完する（AI の取りこぼし対策）
  if (
    isMeetingIntent &&
    userText &&
    !workingSession.collectedFields.deadline &&
    /(今日|明日|あした|来週|再来週|午前|午後|夕方|夜|朝|\d{1,2}時|\d{1,2}:\d{2}|\d{1,2}月\d{1,2}日|\d{1,2}日)/.test(
      userText
    )
  ) {
    workingSession.collectedFields.deadline = userText;
  }

  // AI が inferredIntent を確定した後に shouldCollectContact を再評価する。
  // 一般的な質問（「サービスについて教えて」など）では収集を開始しないよう、
  // 連絡先収集が必要な意図のみ対象にする。
  // name/email/organization のいずれかが収集済みなら無条件で継続する。
  // ただし completed フェーズ後のリセット直後（wasCompletedPhase）は保持した連絡先情報を
  // 収集トリガーとして使わない（新しい意図が必要）。
  const contactFieldsStarted = !wasCompletedPhase && Boolean(
    workingSession.collectedFields.name ||
    workingSession.collectedFields.email ||
    workingSession.collectedFields.organization
  );
  const CONTACT_COLLECTION_INTENTS = [
    "制作相談", "見積もり相談", "日程調整", "業務提携", "導入相談", "資料請求", "打ち合わせ希望"
  ];
  const intentWarrantsContact = workingSession.inferredIntent
    ? CONTACT_COLLECTION_INTENTS.some((intent) => workingSession.inferredIntent!.includes(intent))
    : false;
  const finalShouldCollectContact =
    shouldCollectContact ||
    intentWarrantsContact ||
    contactFieldsStarted;

  const nextFieldRequest = getNextFieldRequest(workingSession.collectedFields, {
    inferredIntent: workingSession.inferredIntent,
    shouldCollectContact: finalShouldCollectContact,
    inputMode,
    // AI が会話文脈から示唆したフィールドをヒントとして渡す（会話とフォームの同期）
    aiSuggestedField: aiResult?.nextFieldRequest ?? null
  });
  // 打ち合わせ意図では連絡先入力より先に希望日時を会話で確認する。
  // deadline は voiceOnly のため、フォーム入力は表示せず assistant 応答で案内する。
  const shouldAskDeadlineFirst = isMeetingIntent && !workingSession.collectedFields.deadline;
  const effectiveNextFieldRequest = shouldAskDeadlineFirst ? null : nextFieldRequest;

  // 日程調整・打ち合わせ意図がある場合は、希望日時（deadline）も確認してから確定フェーズへ移行する。
  // deadline は voiceOnly フィールドのためフォームは表示せず、AI が会話の中で自然に聞き出す。
  const extraRequired: string[] = isMeetingIntent && !workingSession.collectedFields.deadline
    ? ["deadline"]
    : [];
  const hasRequired = [...inquiryConfig.requiredFieldsForSubmit, ...extraRequired].every((field) =>
    Boolean(workingSession.collectedFields[field as keyof typeof workingSession.collectedFields])
  );

  // 必須項目が揃ったら任意フィールドの示唆を無視して必ず確認フェーズへ移行する。
  // ただし修正意図が検出された場合は collecting のまま維持する。
  if (hasRequired && finalShouldCollectContact && !wantsToEdit) {
    workingSession.phase = "confirming";
    workingSession.summaryDraft = summarizeInquiry(workingSession);
  } else {
    workingSession.phase = "collecting";
  }

  // confirming フェーズでは nextFieldRequest を confirmSubmit に上書きする。
  // 任意フィールドが残っていても確認画面を優先する。
  let finalNextFieldRequest = effectiveNextFieldRequest;
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
  let assistantTextRaw =
    workingSession.phase === "confirming"
      ? buildFallbackReply(undefined, workingSession.collectedFields, finalNextFieldRequest)
      : (aiResult?.reply ?? buildFallbackReply(userText, workingSession.collectedFields, finalNextFieldRequest));
  if (
    workingSession.phase !== "confirming" &&
    shouldAskDeadlineFirst &&
    !/(日時|日程|いつ|候補|時間|ご希望)/.test(assistantTextRaw)
  ) {
    assistantTextRaw = "ありがとうございます。まずはご希望の日時を教えていただけますか？ あわせて打ち合わせで確認したい内容があればお知らせください。";
  }
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
