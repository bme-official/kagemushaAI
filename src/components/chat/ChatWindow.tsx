"use client";

import { useMemo, useState } from "react";
import { characterConfig } from "@/config/character.config";
import { uiConfig } from "@/config/ui.config";
import { AvatarShell } from "@/components/avatar/AvatarShell";
import { AvatarStatus } from "@/components/avatar/AvatarStatus";
import { ChatInput } from "@/components/chat/ChatInput";
import { ConversationSummary } from "@/components/chat/ConversationSummary";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { StructuredFieldPrompt } from "@/components/chat/StructuredFieldPrompt";
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

export const ChatWindow = () => {
  const [session, setSession] = useState<ChatSessionState>(createInitialSession);
  const [isLoading, setIsLoading] = useState(false);
  const [nextFieldRequest, setNextFieldRequest] = useState<StructuredFieldRequest | null>(
    null
  );

  const messages = useMemo(() => session.messages, [session.messages]);

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
          <AvatarStatus status={isLoading ? "thinking" : "idle"} />
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
        <ChatInput onSend={handleMessageSend} disabled={isLoading} />
      )}
    </section>
  );
};
