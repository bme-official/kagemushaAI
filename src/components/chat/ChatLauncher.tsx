"use client";

import { uiConfig } from "@/config/ui.config";

type ChatLauncherProps = {
  onClick: () => void;
};

export const ChatLauncher = ({ onClick }: ChatLauncherProps) => {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "10px 14px",
        borderRadius: 8,
        border: "1px solid #0f172a",
        background: "#0f172a",
        color: "#fff",
        cursor: "pointer"
      }}
    >
      {uiConfig.chatLauncherLabel}
    </button>
  );
};
