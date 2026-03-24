"use client";

import { ReactNode } from "react";
import { uiConfig } from "@/config/ui.config";

type ChatModalProps = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
};

export const ChatModal = ({ open, onClose, children }: ChatModalProps) => {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.35)",
        display: "grid",
        placeItems: "center",
        zIndex: 50
      }}
    >
      <div
        style={{
          width: "min(720px, 92vw)",
          height: "min(80vh, 760px)",
          background: "#fff",
          borderRadius: 12,
          boxShadow: "0 10px 35px rgba(0,0,0,0.2)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden"
        }}
      >
        <header
          style={{
            padding: "12px 16px",
            borderBottom: "1px solid #e2e8f0",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}
        >
          <h2 style={{ margin: 0, fontSize: 16 }}>{uiConfig.chatModalTitle}</h2>
          <button type="button" onClick={onClose}>
            {uiConfig.inputLabels.close}
          </button>
        </header>
        <div style={{ flex: 1, minHeight: 0 }}>{children}</div>
      </div>
    </div>
  );
};
