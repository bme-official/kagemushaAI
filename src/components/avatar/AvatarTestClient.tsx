"use client";

import { useMemo, useState } from "react";
import { avatarRuntimeConfig } from "@/config/avatar.runtime.config";
import { VRMCanvas } from "@/components/avatar/VRMCanvas";
import type { AvatarBehaviorState } from "@/types/avatar";

const idleBehavior: AvatarBehaviorState = {
  gesture: "idle",
  voice: "muted",
  expression: "neutral",
  statusLabel: "テスト表示中"
};

const parseCandidateUrls = () => {
  const envUrls = (process.env.NEXT_PUBLIC_VRM_TEST_URLS ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const values = [avatarRuntimeConfig.modelUrl, ...envUrls].filter(Boolean);
  return Array.from(new Set(values));
};

export const AvatarTestClient = () => {
  const candidates = useMemo(parseCandidateUrls, []);
  const [customUrl, setCustomUrl] = useState("");
  const [selectedUrl, setSelectedUrl] = useState(candidates[0] ?? "");
  const activeUrl = customUrl.trim() || selectedUrl;

  return (
    <main style={{ padding: 20, display: "grid", gap: 14 }}>
      <h1 style={{ margin: 0 }}>VRMアバターテスト</h1>
      <p style={{ margin: 0, color: "#475569" }}>
        `NEXT_PUBLIC_VRM_MODEL_URL` と `NEXT_PUBLIC_VRM_TEST_URLS` の候補を切り替えて、表示確認できます。
      </p>
      {candidates.length ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {candidates.map((url, index) => (
            <button
              key={url}
              type="button"
              onClick={() => {
                setCustomUrl("");
                setSelectedUrl(url);
              }}
              style={{
                padding: "7px 10px",
                borderRadius: 8,
                border: "1px solid #cbd5e1",
                background: selectedUrl === url && !customUrl ? "#0f172a" : "#fff",
                color: selectedUrl === url && !customUrl ? "#fff" : "#0f172a",
                cursor: "pointer"
              }}
            >
              {`候補${index + 1}`}
            </button>
          ))}
        </div>
      ) : null}
      <input
        placeholder="VRM URLを直接入力（https://...vrm）"
        value={customUrl}
        onChange={(event) => setCustomUrl(event.target.value)}
        style={{
          width: "min(100%, 860px)",
          border: "1px solid #cbd5e1",
          borderRadius: 8,
          padding: "9px 10px"
        }}
      />
      <div style={{ color: "#64748b", fontSize: 12, wordBreak: "break-all" }}>
        現在のURL: {activeUrl || "未設定"}
      </div>
      <div style={{ width: "min(100%, 860px)", height: "70vh", border: "1px solid #e2e8f0", borderRadius: 12 }}>
        {activeUrl ? (
          <VRMCanvas key={activeUrl} modelUrl={activeUrl} behavior={idleBehavior} />
        ) : (
          <div style={{ height: "100%", display: "grid", placeItems: "center", color: "#64748b" }}>
            VRM URLを設定するとプレビューできます。
          </div>
        )}
      </div>
    </main>
  );
};
