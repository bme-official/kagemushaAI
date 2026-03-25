"use client";

import { FormEvent, useState } from "react";
import { uiConfig } from "@/config/ui.config";

type ChatInputProps = {
  disabled?: boolean;
  onSend: (text: string) => void;
  placeholder?: string;
};

export const ChatInput = ({ disabled, onSend, placeholder }: ChatInputProps) => {
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
      style={{
        display: "flex",
        gap: 8,
        borderTop: "1px solid #e2e8f0",
        padding: 12,
        background: "#f8fafc",
        alignItems: "center"
      }}
    >
      <input
        aria-label={uiConfig.inputLabels.message}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder ?? "例) WEB制作の見積もりを相談したいです"}
        style={{
          flex: 1,
          padding: "10px 12px",
          borderRadius: 10,
          border: "1px solid #cbd5e1",
          background: "#fff"
        }}
      />
      <button
        type="submit"
        disabled={disabled}
        style={{
          padding: "10px 14px",
          borderRadius: 10,
          border: "1px solid #0f172a",
          background: "#0f172a",
          color: "#fff"
        }}
      >
        {uiConfig.inputLabels.send}
      </button>
    </form>
  );
};
