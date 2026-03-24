"use client";

import { FormEvent, useState } from "react";
import { uiConfig } from "@/config/ui.config";
import type { StructuredFieldRequest } from "@/types/chat";

type StructuredFieldPromptProps = {
  request: StructuredFieldRequest;
  onSubmit: (value: string) => void;
  disabled?: boolean;
};

export const StructuredFieldPrompt = ({
  request,
  onSubmit,
  disabled
}: StructuredFieldPromptProps) => {
  const [value, setValue] = useState("");

  if (request.inputType === "confirm") {
    return (
      <div style={{ borderTop: "1px solid #e2e8f0", padding: 12, display: "flex", gap: 8 }}>
        <button type="button" disabled={disabled} onClick={() => onSubmit("yes")}>
          {uiConfig.inputLabels.submitInquiry}
        </button>
        <button type="button" disabled={disabled} onClick={() => onSubmit("no")}>
          {uiConfig.inputLabels.editInquiry}
        </button>
      </div>
    );
  }

  const inputType = request.inputType === "textarea" ? "text" : request.inputType;
  const multiline = request.inputType === "textarea";

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit(value.trim());
    setValue("");
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        borderTop: "1px solid #e2e8f0",
        padding: 12,
        display: "flex",
        gap: 8,
        flexDirection: "column"
      }}
    >
      <label style={{ fontSize: 13 }}>{request.label}</label>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={request.placeholder}
          rows={3}
        />
      ) : (
        <input
          type={inputType}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={request.placeholder}
        />
      )}
      <button type="submit" disabled={disabled}>
        {uiConfig.inputLabels.send}
      </button>
    </form>
  );
};
