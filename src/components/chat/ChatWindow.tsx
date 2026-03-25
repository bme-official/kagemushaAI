"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { characterConfig } from "@/config/character.config";
import { avatarRuntimeConfig } from "@/config/avatar.runtime.config";
import { uiConfig } from "@/config/ui.config";
import { voiceConfig } from "@/config/voice.config";
import { AvatarShell } from "@/components/avatar/AvatarShell";
import { AvatarStatus } from "@/components/avatar/AvatarStatus";
import { VRMCanvas } from "@/components/avatar/VRMCanvas";
import { ChatInput } from "@/components/chat/ChatInput";
import { ConversationSummary } from "@/components/chat/ConversationSummary";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { StructuredFieldPrompt } from "@/components/chat/StructuredFieldPrompt";
import { VoiceControls } from "@/components/chat/VoiceControls";
import type { AvatarBehaviorState } from "@/types/avatar";
import type {
  ChatSessionState,
  ConversationMessage,
  StructuredFieldRequest
} from "@/types/chat";

const createInitialSession = (): ChatSessionState => {
  const initialMessages: ConversationMessage[] = [
    {
      id: crypto.randomUUID(),
      role: "assistant",
      kind: "text",
      content: characterConfig.greeting,
      createdAt: new Date().toISOString()
    },
    {
      id: crypto.randomUUID(),
      role: "assistant",
      kind: "text",
      content: uiConfig.initialQuestion,
      createdAt: new Date().toISOString()
    }
  ];

  return {
    sessionId: crypto.randomUUID(),
    sourcePage: "/contact",
    phase: "collecting",
    inferredCategory: null,
    inferredIntent: null,
    urgency: "low",
    needsHuman: false,
    summaryDraft: "",
    messages: initialMessages,
    collectedFields: {}
  };
};

type ChatApiResponse = {
  session: ChatSessionState;
  assistantMessage: ConversationMessage;
  nextFieldRequest: StructuredFieldRequest | null;
};

type ChatWindowProps = {
  sourcePage?: string;
  enableVoice?: boolean;
};

const detectExpression = (
  latestAssistantMessage: ConversationMessage | undefined,
  urgency: ChatSessionState["urgency"]
): AvatarBehaviorState["expression"] => {
  if (urgency === "high") return "serious";
  const content = latestAssistantMessage?.content ?? "";
  if (/ありがとう|よかった|嬉しい|安心|承知しました/.test(content)) return "smile";
  if (/重要|至急|緊急|急ぎ/.test(content)) return "serious";
  if (/!|！/.test(content)) return "surprised";
  if (/確認|整理|検討/.test(content)) return "thinking";
  return "neutral";
};

export const ChatWindow = ({
  sourcePage = "/contact",
  enableVoice = false
}: ChatWindowProps) => {
  const [session, setSession] = useState<ChatSessionState>(() => {
    const initial = createInitialSession();
    return { ...initial, sourcePage };
  });
  const [isLoading, setIsLoading] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(
    enableVoice && voiceConfig.enabled && voiceConfig.autoSpeakAssistant
  );
  const [nextFieldRequest, setNextFieldRequest] = useState<StructuredFieldRequest | null>(
    null
  );
  const [viewMode, setViewMode] = useState<"voice" | "text">(enableVoice ? "voice" : "text");
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [audioUnlocked, setAudioUnlocked] = useState(!enableVoice);
  const [avatarBehavior, setAvatarBehavior] = useState<AvatarBehaviorState>({
    gesture: "idle",
    voice: "muted",
    expression: "neutral",
    statusLabel: "ご相談受付中"
  });
  const lastSpokenMessageIdRef = useRef<string | null>(null);

  const messages = useMemo(() => session.messages, [session.messages]);
  const latestAssistant = useMemo(
    () => [...messages].reverse().find((msg) => msg.role === "assistant"),
    [messages]
  );
  const canRenderVrm =
    avatarRuntimeConfig.enabled &&
    Boolean(avatarRuntimeConfig.modelUrl) &&
    avatarRuntimeConfig.modelUrl.toLowerCase().endsWith(".vrm");

  const unlockAudio = () => {
    if (!audioUnlocked) {
      setAudioUnlocked(true);
    }
  };

  useEffect(() => {
    if (!enableVoice || !voiceConfig.enabled || !ttsEnabled || !audioUnlocked) return;
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    if (!latestAssistant) return;
    if (lastSpokenMessageIdRef.current === latestAssistant.id) return;

    lastSpokenMessageIdRef.current = latestAssistant.id;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(latestAssistant.content);
    utterance.lang = voiceConfig.locale;
    utterance.rate = voiceConfig.speechRate;
    utterance.pitch = voiceConfig.speechPitch;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  }, [audioUnlocked, enableVoice, latestAssistant, ttsEnabled]);

  useEffect(() => {
    if (!enableVoice || !voiceConfig.enabled || !ttsEnabled) {
      setIsSpeaking(false);
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    }
  }, [enableVoice, ttsEnabled]);

  useEffect(() => {
    const latestAssistantMessage = [...messages].reverse().find((msg) => msg.role === "assistant");
    const expression = detectExpression(latestAssistantMessage, session.urgency);
    const voice: AvatarBehaviorState["voice"] = isListening
      ? "listening"
      : isSpeaking
        ? "speaking"
        : "muted";

    const gesture: AvatarBehaviorState["gesture"] = isListening
      ? "listening"
      : isLoading
        ? "thinking"
        : isSpeaking
          ? expression === "serious"
            ? "emphasis"
            : "explaining"
          : "idle";

    const statusLabel = isListening
      ? "音声を聞き取り中..."
      : isSpeaking
        ? "回答を読み上げ中..."
        : isLoading
          ? "入力内容を整理中..."
          : session.urgency === "high"
            ? "優先度高めで確認中"
            : "ご相談受付中";

    const nextBehavior: AvatarBehaviorState = { gesture, voice, expression, statusLabel };
    setAvatarBehavior(nextBehavior);
  }, [isListening, isLoading, isSpeaking, messages, session.urgency]);

  const postChat = async (payload: {
    userInput?: string;
    fieldResponse?: { fieldName: string; value: string };
  }) => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session,
          ...payload
        })
      });
      if (!response.ok) {
        const errorData = (await response.json()) as { message?: string };
        setSession((prev) => ({
          ...prev,
          messages: [
            ...prev.messages,
            {
              id: crypto.randomUUID(),
              role: "assistant",
              kind: "text",
              content: errorData.message ?? "入力内容をご確認ください。",
              createdAt: new Date().toISOString()
            }
          ]
        }));
        return;
      }
      const data = (await response.json()) as ChatApiResponse;
      setSession(data.session);
      setNextFieldRequest(data.nextFieldRequest);
    } finally {
      setIsLoading(false);
    }
  };

  const submitInquiry = async () => {
    setIsLoading(true);
    try {
      await fetch("/api/inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session })
      });
      setSession((prev) => ({
        ...prev,
        phase: "completed",
        messages: [
          ...prev.messages,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            kind: "text",
            content: uiConfig.completeMessage,
            createdAt: new Date().toISOString()
          }
        ]
      }));
      setNextFieldRequest(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMessageSend = async (text: string) => {
    await postChat({ userInput: text });
  };

  const handleFieldSend = async (value: string) => {
    if (!nextFieldRequest) return;

    if (nextFieldRequest.fieldName === "confirmSubmit") {
      if (value === "yes") {
        await submitInquiry();
      } else {
        setNextFieldRequest(null);
      }
      return;
    }

    await postChat({
      fieldResponse: {
        fieldName: nextFieldRequest.fieldName,
        value
      }
    });
  };

  return (
    <section
      style={{ height: "100%", display: "flex", flexDirection: "column" }}
      onPointerDown={unlockAudio}
    >
      <div
        style={{
          padding: 12,
          borderBottom: "1px solid #e2e8f0",
          display: "flex",
          gap: 8,
          alignItems: "center"
        }}
      >
        <AvatarShell />
        <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.2 }}>
          <strong style={{ fontSize: 14 }}>{characterConfig.name}</strong>
          <AvatarStatus statusLabel={avatarBehavior.statusLabel} />
        </div>
      </div>

      {enableVoice ? (
        <div
          style={{
            display: "flex",
            gap: 8,
            padding: "8px 12px",
            borderBottom: "1px solid #e2e8f0"
          }}
        >
          <button
            type="button"
            onClick={() => setViewMode("voice")}
            style={{
              border: "1px solid #cbd5e1",
              borderRadius: 8,
              padding: "6px 10px",
              background: viewMode === "voice" ? "#0f172a" : "#fff",
              color: viewMode === "voice" ? "#fff" : "#0f172a",
              cursor: "pointer"
            }}
          >
            音声会話
          </button>
          <button
            type="button"
            onClick={() => setViewMode("text")}
            style={{
              border: "1px solid #cbd5e1",
              borderRadius: 8,
              padding: "6px 10px",
              background: viewMode === "text" ? "#0f172a" : "#fff",
              color: viewMode === "text" ? "#fff" : "#0f172a",
              cursor: "pointer"
            }}
          >
            テキスト履歴
          </button>
        </div>
      ) : null}

      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        {viewMode === "voice" && enableVoice ? (
          <>
            <div style={{ flex: "0 0 52%", minHeight: 220, padding: 12 }}>
              <div
                style={{
                  height: "100%",
                  border: "1px solid #e2e8f0",
                  borderRadius: 10,
                  overflow: "hidden",
                  background: "#f8fafc"
                }}
              >
                {canRenderVrm ? (
                  <VRMCanvas modelUrl={avatarRuntimeConfig.modelUrl} behavior={avatarBehavior} />
                ) : (
                  <div
                    style={{
                      height: "100%",
                      display: "grid",
                      placeItems: "center",
                      color: "#64748b",
                      fontSize: 13
                    }}
                  >
                    VRMモデルURLを設定すると音声会話画面にアバターを表示します。
                  </div>
                )}
              </div>
            </div>
            <div style={{ padding: "0 12px 10px", color: "#334155", fontSize: 13 }}>
              {latestAssistant?.content ?? "会話を開始すると、ここに最新の回答を表示します。"}
            </div>
            {!audioUnlocked && ttsEnabled ? (
              <div
                style={{
                  margin: "0 12px 10px",
                  padding: "8px 10px",
                  borderRadius: 8,
                  background: "#fff7ed",
                  color: "#9a3412",
                  fontSize: 12,
                  border: "1px solid #fdba74"
                }}
              >
                ブラウザの制限で音声再生には初回操作が必要です。画面を一度タップ/クリックしてください。
              </div>
            ) : null}
          </>
        ) : (
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: 12,
              display: "flex",
              flexDirection: "column",
              gap: 8
            }}
          >
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
            {session.phase === "confirming" && session.summaryDraft ? (
              <ConversationSummary summary={session.summaryDraft} />
            ) : null}
          </div>
        )}
      </div>

      {session.phase === "completed" ? null : nextFieldRequest ? (
        <StructuredFieldPrompt
          request={nextFieldRequest}
          onSubmit={handleFieldSend}
          disabled={isLoading}
        />
      ) : (
        <>
          {enableVoice ? (
            <VoiceControls
              disabled={isLoading}
              onTranscript={handleMessageSend}
              ttsEnabled={ttsEnabled}
              onToggleTts={setTtsEnabled}
              onListeningChange={setIsListening}
              onUserInteraction={unlockAudio}
            />
          ) : null}
          {viewMode === "text" || !enableVoice ? (
            <ChatInput onSend={handleMessageSend} disabled={isLoading} />
          ) : null}
        </>
      )}
    </section>
  );
};
