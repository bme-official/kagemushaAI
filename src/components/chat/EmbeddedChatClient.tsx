"use client";

import { ChatWindow } from "@/components/chat/ChatWindow";

type EmbeddedChatClientProps = {
  sourcePage: string;
};

export const EmbeddedChatClient = ({ sourcePage }: EmbeddedChatClientProps) => {
  return (
    <main
      style={{
        padding: 0,
        margin: 0,
        height: "100vh",
        background: "#fff"
      }}
    >
      <ChatWindow sourcePage={sourcePage} enableVoice />
    </main>
  );
};
