"use client";

import { useMemo, useState } from "react";
import { avatarRuntimeConfig } from "@/config/avatar.runtime.config";
import { VRMCanvas } from "@/components/avatar/VRMCanvas";
import type {
  AvatarBehaviorState,
  AvatarExpressionState,
  AvatarGestureState,
  AvatarVoiceState
} from "@/types/avatar";

const idleBehavior: AvatarBehaviorState = {
  gesture: "idle",
  voice: "muted",
  expression: "neutral",
  lipSyncActive: false,
  statusLabel: "テスト表示中"
};

const expressionOptions: Array<{ value: AvatarExpressionState; label: string }> = [
  { value: "neutral", label: "通常" },
  { value: "smile", label: "嬉しい" },
  { value: "serious", label: "真剣" },
  { value: "surprised", label: "驚き" },
  { value: "thinking", label: "考え中" }
];

const gestureOptions: Array<{ value: AvatarGestureState; label: string }> = [
  { value: "idle", label: "待機" },
  { value: "thinking", label: "思考" },
  { value: "listening", label: "聞き取り" },
  { value: "explaining", label: "説明" },
  { value: "emphasis", label: "強調" }
];

const defaultStatuses = ["嬉しい", "悲しい", "説明中", "考え中"];

type StatusMapping = {
  expressions: AvatarExpressionState[];
  gestures: AvatarGestureState[];
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
  const [avatarName, setAvatarName] = useState("Leo");
  const [avatarNameKana, setAvatarNameKana] = useState("れお");
  const [voiceModel, setVoiceModel] = useState("ja-JP-standard");
  const [basicInfo, setBasicInfo] = useState("株式会社影武者AI。AIコンシェルジュ提供。");
  const [statuses, setStatuses] = useState(defaultStatuses);
  const [newStatusName, setNewStatusName] = useState("");
  const [activeStatus, setActiveStatus] = useState(defaultStatuses[0]);
  const [statusMappings, setStatusMappings] = useState<Record<string, StatusMapping>>({
    嬉しい: { expressions: ["smile"], gestures: ["explaining"] },
    悲しい: { expressions: ["serious"], gestures: ["idle"] },
    説明中: { expressions: ["neutral", "smile"], gestures: ["explaining", "emphasis"] },
    考え中: { expressions: ["thinking"], gestures: ["thinking"] }
  });
  const [voiceState, setVoiceState] = useState<AvatarVoiceState>("muted");
  const [previewBehavior, setPreviewBehavior] = useState<AvatarBehaviorState>(idleBehavior);
  const activeUrl = customUrl.trim() || selectedUrl;

  const pickRandom = <T,>(values: T[], fallback: T) => {
    if (!values.length) return fallback;
    return values[Math.floor(Math.random() * values.length)];
  };

  const currentMapping = statusMappings[activeStatus] ?? {
    expressions: ["neutral"],
    gestures: ["idle"]
  };

  const toggleExpression = (expression: AvatarExpressionState) => {
    setStatusMappings((prev) => {
      const current = prev[activeStatus] ?? { expressions: [], gestures: [] };
      const exists = current.expressions.includes(expression);
      const expressions = exists
        ? current.expressions.filter((item) => item !== expression)
        : [...current.expressions, expression];
      return {
        ...prev,
        [activeStatus]: { ...current, expressions }
      };
    });
  };

  const toggleGesture = (gesture: AvatarGestureState) => {
    setStatusMappings((prev) => {
      const current = prev[activeStatus] ?? { expressions: [], gestures: [] };
      const exists = current.gestures.includes(gesture);
      const gestures = exists
        ? current.gestures.filter((item) => item !== gesture)
        : [...current.gestures, gesture];
      return {
        ...prev,
        [activeStatus]: { ...current, gestures }
      };
    });
  };

  const applyStatusPreview = (status: string) => {
    const mapping = statusMappings[status] ?? { expressions: ["neutral"], gestures: ["idle"] };
    const expression = pickRandom(mapping.expressions, "neutral");
    const gesture = pickRandom(mapping.gestures, "idle");
    setPreviewBehavior({
      gesture,
      voice: voiceState,
      expression,
      lipSyncActive: voiceState !== "muted",
      statusLabel: status
    });
  };

  const addStatus = () => {
    const next = newStatusName.trim();
    if (!next || statuses.includes(next)) return;
    setStatuses((prev) => [...prev, next]);
    setStatusMappings((prev) => ({
      ...prev,
      [next]: { expressions: ["neutral"], gestures: ["idle"] }
    }));
    setActiveStatus(next);
    setNewStatusName("");
  };

  return (
    <main style={{ padding: 20, display: "grid", gap: 14, alignItems: "start" }}>
      <h1 style={{ margin: 0 }}>VRMアバターテスト</h1>
      <p style={{ margin: 0, color: "#475569" }}>
        アバター表示を見ながら、名前・声・基本情報・ステータスごとの表情/ジェスチャー割り当てを確認できます。
      </p>
      <div style={{ display: "grid", gap: 10, maxWidth: 860 }}>
        <div style={{ display: "grid", gap: 6 }}>
          <label style={{ fontSize: 13, color: "#334155" }}>名前（表示）</label>
          <input
            value={avatarName}
            onChange={(event) => setAvatarName(event.target.value)}
            style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "8px 10px" }}
          />
        </div>
        <div style={{ display: "grid", gap: 6 }}>
          <label style={{ fontSize: 13, color: "#334155" }}>名前（読み）</label>
          <input
            value={avatarNameKana}
            onChange={(event) => setAvatarNameKana(event.target.value)}
            style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "8px 10px" }}
          />
        </div>
        <div style={{ display: "grid", gap: 6 }}>
          <label style={{ fontSize: 13, color: "#334155" }}>声（モデル選択）</label>
          <select
            value={voiceModel}
            onChange={(event) => setVoiceModel(event.target.value)}
            style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "8px 10px" }}
          >
            <option value="ja-JP-standard">ja-JP-standard</option>
            <option value="ja-JP-soft">ja-JP-soft</option>
            <option value="ja-JP-energetic">ja-JP-energetic</option>
          </select>
        </div>
        <div style={{ display: "grid", gap: 6 }}>
          <label style={{ fontSize: 13, color: "#334155" }}>基本情報（読み方含む）</label>
          <textarea
            rows={3}
            value={basicInfo}
            onChange={(event) => setBasicInfo(event.target.value)}
            style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "8px 10px" }}
          />
        </div>
      </div>
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
      <div style={{ display: "grid", gap: 8, maxWidth: 860 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {statuses.map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setActiveStatus(status)}
              style={{
                border: "1px solid #cbd5e1",
                borderRadius: 999,
                padding: "6px 10px",
                background: activeStatus === status ? "#0f172a" : "#fff",
                color: activeStatus === status ? "#fff" : "#0f172a"
              }}
            >
              {status}
            </button>
          ))}
          <input
            placeholder="新しいステータス"
            value={newStatusName}
            onChange={(event) => setNewStatusName(event.target.value)}
            style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "6px 8px" }}
          />
          <button type="button" onClick={addStatus} style={{ borderRadius: 8, border: "1px solid #cbd5e1" }}>
            追加
          </button>
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          <strong style={{ fontSize: 13 }}>表情（重複割り当て可）</strong>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {expressionOptions.map((option) => (
              <label key={option.value} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={currentMapping.expressions.includes(option.value)}
                  onChange={() => toggleExpression(option.value)}
                />
                {option.label}
              </label>
            ))}
          </div>
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          <strong style={{ fontSize: 13 }}>ポージング/ジェスチャー（重複割り当て可）</strong>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {gestureOptions.map((option) => (
              <label key={option.value} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={currentMapping.gestures.includes(option.value)}
                  onChange={() => toggleGesture(option.value)}
                />
                {option.label}
              </label>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 13 }}>声状態プレビュー</span>
          {(["muted", "listening", "speaking"] as AvatarVoiceState[]).map((state) => (
            <button
              key={state}
              type="button"
              onClick={() => setVoiceState(state)}
              style={{
                borderRadius: 8,
                border: "1px solid #cbd5e1",
                background: voiceState === state ? "#0f172a" : "#fff",
                color: voiceState === state ? "#fff" : "#0f172a",
                padding: "6px 10px"
              }}
            >
              {state}
            </button>
          ))}
          <button
            type="button"
            onClick={() => applyStatusPreview(activeStatus)}
            style={{ borderRadius: 8, border: "1px solid #0f172a", background: "#0f172a", color: "#fff", padding: "6px 10px" }}
          >
            現在ステータスをプレビュー適用
          </button>
        </div>
      </div>
      <div style={{ width: "min(100%, 860px)", height: "70vh", border: "1px solid #e2e8f0", borderRadius: 12 }}>
        {activeUrl ? (
          <VRMCanvas key={activeUrl} modelUrl={activeUrl} behavior={previewBehavior} />
        ) : (
          <div style={{ height: "100%", display: "grid", placeItems: "center", color: "#64748b" }}>
            VRM URLを設定するとプレビューできます。
          </div>
        )}
      </div>
      <pre
        style={{
          margin: 0,
          padding: 12,
          background: "#f8fafc",
          border: "1px solid #e2e8f0",
          borderRadius: 8,
          fontSize: 12,
          maxWidth: 860,
          overflowX: "auto"
        }}
      >
        {JSON.stringify(
          {
            profile: { avatarName, avatarNameKana, voiceModel, basicInfo },
            activeStatus,
            mapping: statusMappings[activeStatus],
            previewBehavior
          },
          null,
          2
        )}
      </pre>
    </main>
  );
};
