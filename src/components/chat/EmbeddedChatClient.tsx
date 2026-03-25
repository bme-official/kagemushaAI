"use client";

import { useState } from "react";
import { VRoidPanel } from "@/components/avatar/VRoidPanel";
import { avatarRuntimeConfig } from "@/config/avatar.runtime.config";
import type { AvatarBehaviorState } from "@/types/avatar";
import { ChatWindow } from "@/components/chat/ChatWindow";

type EmbeddedChatClientProps = {
  sourcePage: string;
};

const initialBehavior: AvatarBehaviorState = {
  gesture: "idle",
  voice: "muted",
  expression: "neutral",
  statusLabel: "ご相談受付中"
};

export const EmbeddedChatClient = ({ sourcePage }: EmbeddedChatClientProps) => {
  const [behavior, setBehavior] = useState<AvatarBehaviorState>(initialBehavior);

  return (
    <main
      style={{
        padding: 0,
        margin: 0,
        height: "100vh",
        background: "#fff",
        display: "grid",
        gridTemplateColumns: avatarRuntimeConfig.enabled ? "240px 1fr" : "1fr"
      }}
    >
      {avatarRuntimeConfig.enabled ? <VRoidPanel behavior={behavior} /> : null}
      <ChatWindow sourcePage={sourcePage} enableVoice onAvatarBehaviorChange={setBehavior} />
    </main>
  );
};
