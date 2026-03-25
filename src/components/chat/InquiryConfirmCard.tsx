"use client";

import { useState } from "react";
import type { CollectedContactFields } from "@/types/chat";

type Props = {
  collectedFields: CollectedContactFields;
  onConfirm: () => void;
  onEditField: (fieldName: keyof CollectedContactFields) => void;
  disabled?: boolean;
};

const FIELD_ORDER: Array<{ key: keyof CollectedContactFields; label: string }> = [
  { key: "organization", label: "会社名" },
  { key: "name", label: "お名前" },
  { key: "email", label: "メールアドレス" },
  { key: "phone", label: "電話番号" },
  { key: "inquiryBody", label: "ご相談内容" },
  { key: "budget", label: "予算" },
  { key: "deadline", label: "ご希望日時" }
];

export const InquiryConfirmCard = ({ collectedFields, onConfirm, onEditField, disabled }: Props) => {
  const [editMode, setEditMode] = useState(false);
  const entries = FIELD_ORDER.filter(({ key }) => Boolean(collectedFields[key]));

  if (editMode) {
    return (
      <div
        style={{
          background: "#ffffff",
          borderRadius: 10,
          overflow: "hidden",
          boxShadow: "0 10px 28px rgba(15,23,42,.24)"
        }}
      >
        <div
          style={{
            padding: "10px 14px",
            borderBottom: "1px solid #e2e8f0",
            background: "#f8fafc"
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 700, color: "#334155" }}>
            修正する項目を選んでください
          </span>
        </div>

        <div
          style={{
            padding: "12px 14px",
            display: "flex",
            flexWrap: "wrap",
            gap: 8
          }}
        >
          {entries.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              disabled={disabled}
              onClick={() => {
                setEditMode(false);
                onEditField(key);
              }}
              style={{
                padding: "8px 14px",
                borderRadius: 20,
                border: "1.5px solid #3b82f6",
                background: "#eff6ff",
                color: "#1d4ed8",
                fontSize: 13,
                fontWeight: 600,
                cursor: disabled ? "not-allowed" : "pointer",
                whiteSpace: "nowrap"
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <div
          style={{
            padding: "8px 14px 12px",
            borderTop: "1px solid #e2e8f0"
          }}
        >
          <button
            type="button"
            onClick={() => setEditMode(false)}
            style={{
              width: "100%",
              padding: "8px 12px",
              borderRadius: 8,
              background: "#f1f5f9",
              color: "#475569",
              border: "none",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer"
            }}
          >
            キャンセル
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        background: "#ffffff",
        borderRadius: 10,
        overflow: "hidden",
        boxShadow: "0 10px 28px rgba(15,23,42,.24)"
      }}
    >
      <div
        style={{
          padding: "10px 14px",
          borderBottom: "1px solid #e2e8f0",
          background: "#f8fafc"
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 700, color: "#334155" }}>
          お問い合わせ内容の確認
        </span>
      </div>

      <div
        style={{
          padding: "10px 14px",
          display: "flex",
          flexDirection: "column",
          gap: 8,
          maxHeight: 220,
          overflowY: "auto"
        }}
      >
        {entries.map(({ key, label }) => (
          <div key={key} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
            <span
              style={{
                fontSize: 12,
                color: "#64748b",
                minWidth: 96,
                flexShrink: 0,
                paddingTop: 1
              }}
            >
              {label}
            </span>
            <span style={{ fontSize: 12, color: "#1e293b", wordBreak: "break-all", lineHeight: 1.5 }}>
              {collectedFields[key]}
            </span>
          </div>
        ))}
        {entries.length === 0 && (
          <span style={{ fontSize: 12, color: "#94a3b8" }}>入力内容がありません</span>
        )}
      </div>

      <div
        style={{
          padding: "8px 14px 12px",
          display: "flex",
          gap: 8,
          borderTop: "1px solid #e2e8f0"
        }}
      >
        <button
          type="button"
          disabled={disabled}
          onClick={onConfirm}
          style={{
            flex: 1,
            padding: "9px 12px",
            borderRadius: 8,
            background: disabled ? "#93c5fd" : "#3b82f6",
            color: "#ffffff",
            border: "none",
            fontSize: 13,
            fontWeight: 600,
            cursor: disabled ? "not-allowed" : "pointer"
          }}
        >
          この内容で送信
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setEditMode(true)}
          style={{
            padding: "9px 16px",
            borderRadius: 8,
            background: disabled ? "#f1f5f9" : "#f1f5f9",
            color: disabled ? "#94a3b8" : "#475569",
            border: "none",
            fontSize: 13,
            fontWeight: 600,
            cursor: disabled ? "not-allowed" : "pointer"
          }}
        >
          修正する
        </button>
      </div>
    </div>
  );
};
