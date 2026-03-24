import type { ConversationMessage } from "@/types/chat";

type MessageBubbleProps = {
  message: ConversationMessage;
};

export const MessageBubble = ({ message }: MessageBubbleProps) => {
  const isUser = message.role === "user";
  return (
    <div
      style={{
        alignSelf: isUser ? "flex-end" : "flex-start",
        background: isUser ? "#0f172a" : "#f1f5f9",
        color: isUser ? "#fff" : "#0f172a",
        borderRadius: 10,
        padding: "10px 12px",
        maxWidth: "80%",
        whiteSpace: "pre-wrap",
        fontSize: 14
      }}
    >
      {message.content}
    </div>
  );
};
