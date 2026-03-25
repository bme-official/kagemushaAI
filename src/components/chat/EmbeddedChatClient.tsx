"use client";

import { ChatWindow } from "@/components/chat/ChatWindow";

type EmbeddedChatClientProps = {
  sourcePage: string;
  autoUnlockAudio?: boolean;
};

export const EmbeddedChatClient = ({
  sourcePage,
  autoUnlockAudio = false
}: EmbeddedChatClientProps) => {
  return (
    <main
      style={{
        padding: 0,
        margin: 0,
        height: "100vh",
        background: "#fff"
      }}
    >
      <ChatWindow sourcePage={sourcePage} enableVoice initialAudioUnlocked={autoUnlockAudio} />
    </main>
  );
};
