"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import type { StructuredFieldRequest } from "@/types/chat";

type StructuredFieldPromptProps = {
  request: StructuredFieldRequest;
  onSubmit: (value: string) => void;
  onSkip?: () => void;
  disabled?: boolean;
};

export const StructuredFieldPrompt = ({
  request,
  onSubmit,
  onSkip,
  disabled
}: StructuredFieldPromptProps) => {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // フォームが表示されたら自動フォーカス
  useEffect(() => {
    const t = window.setTimeout(() => {
      inputRef.current?.focus();
      textareaRef.current?.focus();
    }, 120);
    return () => window.clearTimeout(t);
  }, [request.fieldName]);

  if (request.inputType === "confirm") {
    return null; // confirm は InquiryConfirmCard で処理
  }

  const isMultiline = request.inputType === "textarea";
  const htmlInputType = isMultiline ? "text" : request.inputType;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = value.trim();
    if (!trimmed && request.required) return;
    onSubmit(trimmed);
    setValue("");
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        background: "#ffffff",
        borderRadius: 12,
        overflow: "hidden",
        boxShadow: "0 12px 32px rgba(15,23,42,.22), 0 2px 8px rgba(15,23,42,.08)"
      }}
    >
      {/* ヘッダー */}
      <div
        style={{
          padding: "10px 14px 8px",
          background: "linear-gradient(135deg,#f8fafc 0%,#f1f5f9 100%)",
          borderBottom: "1px solid #e2e8f0",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 700, color: "#334155", letterSpacing: "0.02em" }}>
          {request.label}
          {request.required ? (
            <span style={{ color: "#ef4444", marginLeft: 3 }}>*</span>
          ) : (
            <span style={{ color: "#94a3b8", fontSize: 11, fontWeight: 400, marginLeft: 4 }}>
              （任意）
            </span>
          )}
        </span>
        {!request.required && onSkip ? (
          <button
            type="button"
            onClick={onSkip}
            style={{
              fontSize: 11,
              color: "#94a3b8",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "2px 4px",
              borderRadius: 4
            }}
          >
            スキップ
          </button>
        ) : null}
      </div>

      {/* 入力エリア */}
      <div style={{ padding: "10px 14px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
        {isMultiline ? (
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={request.placeholder}
            rows={3}
            disabled={disabled}
            style={{
              width: "100%",
              padding: "8px 10px",
              borderRadius: 8,
              border: "1.5px solid #e2e8f0",
              fontSize: 14,
              color: "#1e293b",
              background: "#f8fafc",
              outline: "none",
              resize: "none",
              boxSizing: "border-box",
              lineHeight: 1.5,
              transition: "border-color 150ms"
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = "#3b82f6"; e.currentTarget.style.background = "#fff"; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.background = "#f8fafc"; }}
          />
        ) : (
          <input
            ref={inputRef}
            type={htmlInputType}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={request.placeholder}
            disabled={disabled}
            style={{
              width: "100%",
              padding: "9px 12px",
              borderRadius: 8,
              border: "1.5px solid #e2e8f0",
              fontSize: 14,
              color: "#1e293b",
              background: "#f8fafc",
              outline: "none",
              boxSizing: "border-box",
              transition: "border-color 150ms, background 150ms"
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = "#3b82f6"; e.currentTarget.style.background = "#fff"; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.background = "#f8fafc"; }}
          />
        )}

        <button
          type="submit"
          disabled={disabled || (!value.trim() && request.required)}
          style={{
            padding: "9px 12px",
            borderRadius: 8,
            background:
              disabled || (!value.trim() && request.required) ? "#93c5fd" : "#3b82f6",
            color: "#ffffff",
            border: "none",
            fontSize: 13,
            fontWeight: 600,
            cursor:
              disabled || (!value.trim() && request.required) ? "not-allowed" : "pointer",
            transition: "background 150ms"
          }}
        >
          入力して次へ →
        </button>
      </div>
    </form>
  );
};
