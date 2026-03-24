"use client";

import { FormEvent, useState } from "react";
import { uiConfig } from "@/config/ui.config";

type ChatInputProps = {
  disabled?: boolean;
  onSend: (text: string) => void;
};

export const ChatInput = ({ disabled, onSend }: ChatInputProps) => {
  const [value, setValue] = useState("");

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{ display: "flex", gap: 8, borderTop: "1px solid #e2e8f0", padding: 12 }}
    >
      <input
        aria-label={uiConfig.inputLabels.message}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="例) WEB制作の見積もりを相談したいです"
        style={{ flex: 1, padding: 10 }}
      />
      <button type="submit" disabled={disabled}>
        {uiConfig.inputLabels.send}
      </button>
    </form>
  );
};
