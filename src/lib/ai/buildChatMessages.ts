import type { ChatSessionState } from "@/types/chat";

export const buildChatMessages = (session: ChatSessionState, userInput?: string) => {
  const history = session.messages.map((m) => ({
    role: m.role,
    content: m.content
  }));

  if (userInput) {
    history.push({ role: "user", content: userInput });
  }

  return history;
};
