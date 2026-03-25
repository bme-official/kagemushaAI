"use client";

import { useEffect, useMemo, useState } from "react";
import { avatarRuntimeConfig } from "@/config/avatar.runtime.config";
import { VRMCanvas } from "@/components/avatar/VRMCanvas";
import type {
  AvatarBehaviorState,
  AvatarExpressionState,
  AvatarGestureState,
  AvatarPoseState,
  AvatarVoiceState
} from "@/types/avatar";

const idleBehavior: AvatarBehaviorState = {
  pose: "neutral",
  gesture: "idle",
  voice: "muted",
  expression: "neutral",
  lipSyncActive: false,
  statusLabel: "テスト表示中"
};

const expressionOptions: Array<{ id: string; value: AvatarExpressionState; label: string }> = [
  { id: "neutral_default", value: "neutral", label: "通常" },
  { id: "smile_happy", value: "smile", label: "嬉しい" },
  { id: "serious_focus", value: "serious", label: "真剣" },
  { id: "surprised_alert", value: "surprised", label: "驚き" },
  { id: "thinking_deep", value: "thinking", label: "考え中" },
  { id: "smile_relief", value: "smile", label: "安心" },
  { id: "serious_sad", value: "serious", label: "悲しい" }
];

const gestureOptions: Array<{ id: string; value: AvatarGestureState; label: string }> = [
  { id: "idle_wait", value: "idle", label: "待機" },
  { id: "thinking_pose", value: "thinking", label: "思考" },
  { id: "listening_default", value: "listening", label: "聞き取り" },
  { id: "explain_general", value: "explaining", label: "説明" },
  { id: "emphasis_point", value: "emphasis", label: "強調" },
  { id: "listening_empathy", value: "listening", label: "共感" },
  { id: "explain_guide", value: "explaining", label: "案内" }
];

const poseOptions: Array<{ value: AvatarPoseState; label: string }> = [
  { value: "neutral", label: "標準姿勢" },
  { value: "upright", label: "背筋を伸ばす" },
  { value: "friendly", label: "親しみ" },
  { value: "leanForward", label: "前のめり" },
  { value: "confident", label: "自信" }
];

const defaultStatuses = ["嬉しい", "悲しい", "説明中", "考え中", "安心", "緊張"];

type StatusMapping = {
  expressions: AvatarExpressionState[];
  poses: AvatarPoseState[];
  gestures: AvatarGestureState[];
};

type ServiceItem = {
  name: string;
  ruby: string;
  description: string;
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
  const [avatarAge, setAvatarAge] = useState("25");
  const [companyName, setCompanyName] = useState("株式会社影武者AI");
  const [companyNameKana, setCompanyNameKana] = useState("かぶしきがいしゃかげむしゃえーあい");
  const [voiceModel, setVoiceModel] = useState("ja-JP-standard");
  const [profile, setProfile] = useState("丁寧で落ち着いた口調。ヒアリングと要約が得意。");
  const [statuses, setStatuses] = useState(defaultStatuses);
  const [newStatusName, setNewStatusName] = useState("");
  const [activeStatus, setActiveStatus] = useState(defaultStatuses[0]);
  const [services, setServices] = useState<ServiceItem[]>([
    {
      name: "AIコンシェルジュ",
      ruby: "えーあいこんしぇるじゅ",
      description: "問い合わせの一次対応と要約を自動化"
    }
  ]);
  const [statusMappings, setStatusMappings] = useState<Record<string, StatusMapping>>({
    嬉しい: { expressions: ["smile"], poses: ["friendly"], gestures: ["explaining"] },
    悲しい: { expressions: ["serious"], poses: ["leanForward"], gestures: ["idle"] },
    説明中: {
      expressions: ["neutral", "smile"],
      poses: ["upright", "confident"],
      gestures: ["explaining", "emphasis"]
    },
    考え中: { expressions: ["thinking"], poses: ["upright"], gestures: ["thinking"] },
    安心: { expressions: ["smile"], poses: ["neutral"], gestures: ["listening"] },
    緊張: { expressions: ["serious"], poses: ["upright"], gestures: ["listening"] }
  });
  const [voiceState, setVoiceState] = useState<AvatarVoiceState>("muted");
  const [previewBehavior, setPreviewBehavior] = useState<AvatarBehaviorState>(idleBehavior);
  const activeUrl = customUrl.trim() || selectedUrl;

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      "kagemusha-avatar-settings",
      JSON.stringify({
        avatarName,
        avatarNameKana,
        avatarAge,
        companyName,
        companyNameKana,
        voiceModel,
        profile,
        services,
        statuses,
        statusMappings
      })
    );
  }, [
    avatarAge,
    avatarName,
    avatarNameKana,
    companyName,
    companyNameKana,
    profile,
    services,
    statusMappings,
    statuses,
    voiceModel
  ]);

  const pickRandom = <T,>(values: T[], fallback: T) => {
    if (!values.length) return fallback;
    return values[Math.floor(Math.random() * values.length)];
  };

  const currentMapping = statusMappings[activeStatus] ?? {
    expressions: ["neutral"],
    poses: ["neutral"],
    gestures: ["idle"]
  };

  const toggleExpression = (expression: AvatarExpressionState) => {
    setStatusMappings((prev) => {
      const current = prev[activeStatus] ?? { expressions: [], poses: [], gestures: [] };
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

  const togglePose = (pose: AvatarPoseState) => {
    setStatusMappings((prev) => {
      const current = prev[activeStatus] ?? { expressions: [], poses: [], gestures: [] };
      const exists = current.poses.includes(pose);
      const poses = exists ? current.poses.filter((item) => item !== pose) : [...current.poses, pose];
      return {
        ...prev,
        [activeStatus]: { ...current, poses }
      };
    });
  };

  const toggleGesture = (gesture: AvatarGestureState) => {
    setStatusMappings((prev) => {
      const current = prev[activeStatus] ?? { expressions: [], poses: [], gestures: [] };
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
    const mapping = statusMappings[status] ?? {
      expressions: ["neutral"],
      poses: ["neutral"],
      gestures: ["idle"]
    };
    const expression = pickRandom(mapping.expressions, "neutral");
    const pose = pickRandom(mapping.poses, "neutral");
    const gesture = pickRandom(mapping.gestures, "idle");
    setPreviewBehavior({
      pose,
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
      [next]: { expressions: ["neutral"], poses: ["neutral"], gestures: ["idle"] }
    }));
    setActiveStatus(next);
    setNewStatusName("");
  };

  const addService = () => {
    if (services.length >= 10) return;
    setServices((prev) => [...prev, { name: "", ruby: "", description: "" }]);
  };

  const updateService = (index: number, patch: Partial<ServiceItem>) => {
    setServices((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  const removeService = (index: number) => {
    setServices((prev) => prev.filter((_, i) => i !== index));
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
          <label style={{ fontSize: 13, color: "#334155" }}>年齢</label>
          <input
            value={avatarAge}
            onChange={(event) => setAvatarAge(event.target.value)}
            style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "8px 10px" }}
          />
        </div>
        <div style={{ display: "grid", gap: 6 }}>
          <label style={{ fontSize: 13, color: "#334155" }}>企業名</label>
          <input
            value={companyName}
            onChange={(event) => setCompanyName(event.target.value)}
            style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "8px 10px" }}
          />
        </div>
        <div style={{ display: "grid", gap: 6 }}>
          <label style={{ fontSize: 13, color: "#334155" }}>企業名（読み）</label>
          <input
            value={companyNameKana}
            onChange={(event) => setCompanyNameKana(event.target.value)}
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
          <label style={{ fontSize: 13, color: "#334155" }}>プロフィール</label>
          <textarea
            rows={3}
            value={profile}
            onChange={(event) => setProfile(event.target.value)}
            style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "8px 10px" }}
          />
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <label style={{ fontSize: 13, color: "#334155" }}>サービス一覧（最大10件）</label>
            <button type="button" onClick={addService} disabled={services.length >= 10}>
              追加
            </button>
          </div>
          {services.map((service, index) => (
            <div
              key={`${index}-${service.name}`}
              style={{
                border: "1px solid #e2e8f0",
                borderRadius: 8,
                padding: 10,
                display: "grid",
                gap: 6
              }}
            >
              <input
                placeholder="サービス名"
                value={service.name}
                onChange={(event) => updateService(index, { name: event.target.value })}
                style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "8px 10px" }}
              />
              <input
                placeholder="サービス名（読み）"
                value={service.ruby}
                onChange={(event) => updateService(index, { ruby: event.target.value })}
                style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "8px 10px" }}
              />
              <textarea
                placeholder="サービス説明"
                rows={2}
                value={service.description}
                onChange={(event) => updateService(index, { description: event.target.value })}
                style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "8px 10px" }}
              />
              <button type="button" onClick={() => removeService(index)} disabled={services.length <= 1}>
                削除
              </button>
            </div>
          ))}
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
          <strong style={{ fontSize: 13 }}>表情（感情ごとに割り当て、重複可）</strong>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {expressionOptions.map((option) => (
              <label key={option.id} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
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
          <strong style={{ fontSize: 13 }}>ポージング（感情ごとに割り当て、重複可）</strong>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {poseOptions.map((option) => (
              <label key={option.value} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={currentMapping.poses.includes(option.value)}
                  onChange={() => togglePose(option.value)}
                />
                {option.label}
              </label>
            ))}
          </div>
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          <strong style={{ fontSize: 13 }}>ジェスチャー（感情ごとに割り当て、重複可）</strong>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {gestureOptions.map((option) => (
              <label key={option.id} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
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
            profile: {
              avatarName,
              avatarNameKana,
              avatarAge,
              companyName,
              companyNameKana,
              voiceModel,
              profile,
              services
            },
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
