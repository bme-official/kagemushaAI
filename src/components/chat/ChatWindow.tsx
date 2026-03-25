"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { characterConfig } from "@/config/character.config";
import { uiConfig } from "@/config/ui.config";
import { voiceConfig } from "@/config/voice.config";
import { AvatarShell } from "@/components/avatar/AvatarShell";
import { AvatarStatus } from "@/components/avatar/AvatarStatus";
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
  onAvatarBehaviorChange?: (behavior: AvatarBehaviorState) => void;
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
  enableVoice = false,
  onAvatarBehaviorChange
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
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [avatarBehavior, setAvatarBehavior] = useState<AvatarBehaviorState>({
    gesture: "idle",
    voice: "muted",
    expression: "neutral",
    statusLabel: "ご相談受付中"
  });
  const lastSpokenMessageIdRef = useRef<string | null>(null);

  const messages = useMemo(() => session.messages, [session.messages]);

  useEffect(() => {
    if (!enableVoice || !voiceConfig.enabled || !ttsEnabled) return;
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    const latestAssistant = [...messages].reverse().find((msg) => msg.role === "assistant");
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
  }, [enableVoice, messages, ttsEnabled]);

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
    onAvatarBehaviorChange?.(nextBehavior);
  }, [isListening, isLoading, isSpeaking, messages, onAvatarBehaviorChange, session.urgency]);

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
    <section style={{ height: "100%", display: "flex", flexDirection: "column" }}>
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

      <div style={{ flex: 1, overflowY: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
        {session.phase === "confirming" && session.summaryDraft ? (
          <ConversationSummary summary={session.summaryDraft} />
        ) : null}
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
            />
          ) : null}
          <ChatInput onSend={handleMessageSend} disabled={isLoading} />
        </>
      )}
    </section>
  );
};
