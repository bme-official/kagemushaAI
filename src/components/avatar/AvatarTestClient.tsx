"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  { id: "explain_guide", value: "explaining", label: "案内" },
  { id: "arm_cross", value: "armCross", label: "腕組み" },
  { id: "wave_hand", value: "waveHand", label: "手を振る" },
  { id: "point_finger", value: "pointFinger", label: "指を立てる" }
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
  expressionOptionIds: string[];
  poses: AvatarPoseState[];
  gestureOptionIds: string[];
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
  const [ttsApiVoice, setTtsApiVoice] = useState("shimmer");
  const [voicePreviewLoading, setVoicePreviewLoading] = useState(false);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
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
    嬉しい: { expressionOptionIds: ["smile_happy"], poses: ["friendly"], gestureOptionIds: ["explain_general"] },
    悲しい: { expressionOptionIds: ["serious_sad"], poses: ["leanForward"], gestureOptionIds: ["idle_wait"] },
    説明中: {
      expressionOptionIds: ["neutral_default", "smile_happy"],
      poses: ["upright", "confident"],
      gestureOptionIds: ["explain_general", "emphasis_point"]
    },
    考え中: { expressionOptionIds: ["thinking_deep"], poses: ["upright"], gestureOptionIds: ["thinking_pose"] },
    安心: { expressionOptionIds: ["smile_relief"], poses: ["neutral"], gestureOptionIds: ["listening_empathy"] },
    緊張: { expressionOptionIds: ["serious_focus"], poses: ["upright"], gestureOptionIds: ["listening_default"] }
  });
  const [voiceState, setVoiceState] = useState<AvatarVoiceState>("muted");
  const [previewBehavior, setPreviewBehavior] = useState<AvatarBehaviorState>(idleBehavior);
  const [saveMessage, setSaveMessage] = useState("");
  // 知識ベース
  const [knowledgeBaseUrl, setKnowledgeBaseUrl] = useState("");
  const [knowledgeBaseText, setKnowledgeBaseText] = useState("");
  const [scrapeLoading, setScrapeLoading] = useState(false);
  const [scrapeMessage, setScrapeMessage] = useState("");
  // TTS 読み方補正
  const [ttsCorrections, setTtsCorrections] = useState<Array<{ term: string; reading: string }>>([]);
  const activeUrl = customUrl.trim() || selectedUrl;

  const applySettingsPayload = useCallback((parsed: {
    modelUrl?: string;
    avatarName?: string;
    avatarNameKana?: string;
    avatarAge?: string;
    companyName?: string;
    companyNameKana?: string;
    ttsApiVoice?: string;
    profile?: string;
    services?: ServiceItem[];
    statuses?: string[];
    statusMappings?: Record<string, StatusMapping>;
    knowledgeBaseUrl?: string;
    knowledgeBaseText?: string;
    ttsCorrections?: Array<{ term: string; reading: string }>;
  }) => {
    if (parsed.modelUrl) {
      if (candidates.includes(parsed.modelUrl)) {
        setSelectedUrl(parsed.modelUrl);
        setCustomUrl("");
      } else {
        setCustomUrl(parsed.modelUrl);
      }
    }
    if (parsed.avatarName) setAvatarName(parsed.avatarName);
    if (parsed.avatarNameKana) setAvatarNameKana(parsed.avatarNameKana);
    if (parsed.avatarAge) setAvatarAge(parsed.avatarAge);
    if (parsed.companyName) setCompanyName(parsed.companyName);
    if (parsed.companyNameKana) setCompanyNameKana(parsed.companyNameKana);
    if (parsed.ttsApiVoice) setTtsApiVoice(parsed.ttsApiVoice);
    if (parsed.profile) setProfile(parsed.profile);
    if (parsed.services?.length) setServices(parsed.services.slice(0, 10));
    if (parsed.statuses?.length) setStatuses(parsed.statuses);
    if (parsed.statusMappings) setStatusMappings(parsed.statusMappings);
    if (parsed.knowledgeBaseUrl) setKnowledgeBaseUrl(parsed.knowledgeBaseUrl);
    if (parsed.knowledgeBaseText) setKnowledgeBaseText(parsed.knowledgeBaseText);
    if (parsed.ttsCorrections) setTtsCorrections(parsed.ttsCorrections);
  }, [candidates]);

  const handleVoicePreview = useCallback(async () => {
    if (voicePreviewLoading) return;
    // 再生中の場合は停止
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
      setVoicePreviewLoading(false);
      return;
    }
    setVoicePreviewLoading(true);
    try {
      const sampleText = `こんにちは！私の声はこのようなものです。どうぞよろしくお願いします。`;
      const response = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: sampleText, voice: ttsApiVoice })
      });
      if (!response.ok) throw new Error("TTS failed");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      previewAudioRef.current = audio;
      audio.onended = () => {
        URL.revokeObjectURL(url);
        previewAudioRef.current = null;
        setVoicePreviewLoading(false);
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        previewAudioRef.current = null;
        setVoicePreviewLoading(false);
      };
      await audio.play();
    } catch {
      setVoicePreviewLoading(false);
    }
  }, [ttsApiVoice, voicePreviewLoading]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;
    const loadFromServer = async () => {
      try {
        const response = await fetch("/api/avatar-settings", { cache: "no-store" });
        if (!response.ok) return;
        const data = (await response.json()) as {
          settings?: {
            modelUrl?: string;
            avatarName?: string;
            avatarNameKana?: string;
            avatarAge?: string;
            companyName?: string;
            companyNameKana?: string;
            ttsApiVoice?: string;
            profile?: string;
            services?: ServiceItem[];
            statuses?: string[];
            statusMappings?: Record<string, StatusMapping>;
          } | null;
        };
        if (cancelled || !data.settings) return;
        applySettingsPayload(data.settings);
      } catch {
        // ignore server load error and fallback to localStorage
      }
    };
    loadFromServer();

    try {
      const raw = window.localStorage.getItem("kagemusha-avatar-settings");
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        modelUrl?: string;
        avatarName?: string;
        avatarNameKana?: string;
        avatarAge?: string;
        companyName?: string;
        companyNameKana?: string;
        ttsApiVoice?: string;
        profile?: string;
        services?: ServiceItem[];
        statuses?: string[];
        statusMappings?: Record<string, StatusMapping>;
      };
      applySettingsPayload(parsed);
    } catch {
      // ignore broken saved payload
    }
    return () => {
      cancelled = true;
    };
  }, [applySettingsPayload]);

  const handleSaveSettings = async () => {
    if (typeof window === "undefined") return;
    const payload = {
      modelUrl: activeUrl,
      avatarName,
      avatarNameKana,
      avatarAge,
      companyName,
      companyNameKana,
      ttsApiVoice,
      profile,
      services,
      statuses,
      statusMappings,
      knowledgeBaseUrl,
      knowledgeBaseText,
      ttsCorrections: ttsCorrections.filter((c) => c.term && c.reading)
    };
    window.localStorage.setItem(
      "kagemusha-avatar-settings",
      JSON.stringify(payload)
    );
    window.dispatchEvent(new Event("kagemusha-avatar-settings-updated"));
    try {
      await fetch("/api/avatar-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: payload })
      });
      setSaveMessage(`保存しました（サイト全体に反映） ${new Date().toLocaleTimeString("ja-JP")}`);
    } catch {
      setSaveMessage(`ローカルには保存済み（サーバー保存失敗） ${new Date().toLocaleTimeString("ja-JP")}`);
    }
  };

  const pickRandom = <T,>(values: T[], fallback: T) => {
    if (!values.length) return fallback;
    return values[Math.floor(Math.random() * values.length)];
  };

  const currentMapping = statusMappings[activeStatus] ?? {
    expressionOptionIds: ["neutral_default"],
    poses: ["neutral"],
    gestureOptionIds: ["idle_wait"]
  };

  const toggleExpression = (expressionOptionId: string) => {
    setStatusMappings((prev) => {
      const current = prev[activeStatus] ?? { expressionOptionIds: [], poses: [], gestureOptionIds: [] };
      const exists = current.expressionOptionIds.includes(expressionOptionId);
      const expressionOptionIds = exists
        ? current.expressionOptionIds.filter((item) => item !== expressionOptionId)
        : [...current.expressionOptionIds, expressionOptionId];
      return {
        ...prev,
        [activeStatus]: { ...current, expressionOptionIds }
      };
    });
  };

  const togglePose = (pose: AvatarPoseState) => {
    setStatusMappings((prev) => {
      const current = prev[activeStatus] ?? {
        expressionOptionIds: [],
        poses: [],
        gestureOptionIds: []
      };
      const exists = current.poses.includes(pose);
      const poses = exists ? current.poses.filter((item) => item !== pose) : [...current.poses, pose];
      return {
        ...prev,
        [activeStatus]: { ...current, poses }
      };
    });
  };

  const toggleGesture = (gestureOptionId: string) => {
    setStatusMappings((prev) => {
      const current = prev[activeStatus] ?? {
        expressionOptionIds: [],
        poses: [],
        gestureOptionIds: []
      };
      const exists = current.gestureOptionIds.includes(gestureOptionId);
      const gestureOptionIds = exists
        ? current.gestureOptionIds.filter((item) => item !== gestureOptionId)
        : [...current.gestureOptionIds, gestureOptionId];
      return {
        ...prev,
        [activeStatus]: { ...current, gestureOptionIds }
      };
    });
  };

  const applyStatusPreview = (status: string) => {
    const mapping = statusMappings[status] ?? {
      expressionOptionIds: ["neutral_default"],
      poses: ["neutral"],
      gestureOptionIds: ["idle_wait"]
    };
    const expressionOption = pickRandom(
      expressionOptions.filter((item) => mapping.expressionOptionIds.includes(item.id)),
      expressionOptions[0]
    );
    const gestureOption = pickRandom(
      gestureOptions.filter((item) => mapping.gestureOptionIds.includes(item.id)),
      gestureOptions[0]
    );
    const expression = expressionOption.value;
    const pose = pickRandom(mapping.poses, "neutral");
    const gesture = gestureOption.value;
    setPreviewBehavior({
      pose,
      gesture,
      voice: voiceState,
      expression,
      lipSyncActive: voiceState === "speaking",
      statusLabel: status
    });
  };

  useEffect(() => {
    setPreviewBehavior((prev) => ({
      ...prev,
      voice: voiceState,
      lipSyncActive: voiceState === "speaking"
    }));
  }, [voiceState]);

  const addStatus = () => {
    const next = newStatusName.trim();
    if (!next || statuses.includes(next)) return;
    setStatuses((prev) => [...prev, next]);
    setStatusMappings((prev) => ({
      ...prev,
      [next]: {
        expressionOptionIds: ["neutral_default"],
        poses: ["neutral"],
        gestureOptionIds: ["idle_wait"]
      }
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
      <h1 style={{ margin: 0 }}>VRMアバター設定</h1>
      <p style={{ margin: 0, color: "#475569" }}>
        アバター表示を見ながら、名前・声・基本情報・ステータスごとの表情/ジェスチャー割り当てを確認できます。
      </p>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <button
          type="button"
          onClick={handleSaveSettings}
          style={{
            borderRadius: 10,
            border: "1px solid #0f172a",
            background: "#0f172a",
            color: "#fff",
            padding: "8px 14px"
          }}
        >
          保存して反映
        </button>
        {saveMessage ? <span style={{ fontSize: 12, color: "#334155" }}>{saveMessage}</span> : null}
      </div>
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
        <div style={{ display: "grid", gap: 8 }}>
          <label style={{ fontSize: 13, color: "#334155", fontWeight: 600 }}>
            声の選択
            <span style={{ fontSize: 11, color: "#64748b", marginLeft: 6, fontWeight: 400 }}>
              日本語対応 AI 音声（全ブラウザ・iOS で確実に動作）
            </span>
          </label>
          <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
            <select
              value={ttsApiVoice}
              onChange={(event) => setTtsApiVoice(event.target.value)}
              style={{ flex: 1, border: "1px solid #cbd5e1", borderRadius: 8, padding: "8px 10px" }}
            >
              <optgroup label="ElevenLabs — プリメイド女性（無料プランで使用可）">
                <option value="el:21m00Tcm4TlvDq8ikWAM">Rachel — 落ち着いた女性</option>
                <option value="el:EXAVITQu4vr4xnSDxMaL">Bella — 明るい女性</option>
                <option value="el:MF3mGyEYCl7XYWbV9V9of">Elli — やさしい女性</option>
              </optgroup>
              <optgroup label="ElevenLabs — プリメイド男性（無料プランで使用可）">
                <option value="el:pNInz6obpgDQGcFmaJgB">Adam — 男性・ナチュラル</option>
                <option value="el:ErXwobaYiN019PkySvjV">Antoni — 男性・自信</option>
                <option value="el:TxGEqnHWrfWFTfGW9XjX">Josh — 男性・若め</option>
                <option value="el:yoZ06aMxZJJ28mfd3POQ">Sam — 男性・エネルギー</option>
                <option value="el:JBFqnCBsd6RMkjVDRZzb">George — 男性・深み</option>
              </optgroup>
              <optgroup label="ElevenLabs — ボイスライブラリ（有料プラン必須）">
                <option value="el:3JDquces8E8bkmvbh6Bc">おすすめ日本語ボイス（要Starter以上）</option>
              </optgroup>
              <optgroup label="OpenAI — 女性（日本語対応）">
                <option value="shimmer">shimmer — 落ち着いた女性 ★日本語推奨</option>
                <option value="nova">nova — 自然な女性</option>
                <option value="coral">coral — 温かみのある女性</option>
                <option value="sage">sage — 穏やかな中性</option>
              </optgroup>
              <optgroup label="OpenAI — 男性（日本語対応）">
                <option value="echo">echo — 男性</option>
                <option value="onyx">onyx — 低音男性</option>
                <option value="ash">ash — 落ち着いた男性</option>
                <option value="fable">fable — 英国アクセント男性</option>
              </optgroup>
              <optgroup label="OpenAI — ニュートラル">
                <option value="alloy">alloy — ニュートラル</option>
              </optgroup>
            </select>
            <button
              type="button"
              onClick={handleVoicePreview}
              disabled={false}
              style={{
                border: "1px solid #0f172a",
                borderRadius: 8,
                background: voicePreviewLoading ? "#64748b" : "#0f172a",
                color: "#fff",
                padding: "8px 14px",
                fontSize: 13,
                cursor: "pointer",
                whiteSpace: "nowrap",
                minWidth: 72
              }}
            >
              {voicePreviewLoading ? "■ 停止" : "▶ 試聴"}
            </button>
          </div>
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

        {/* 知識ベース */}
        <div style={{ display: "grid", gap: 10, borderTop: "1px solid #e2e8f0", paddingTop: 16, marginTop: 8 }}>
          <label style={{ fontSize: 14, fontWeight: 700, color: "#1e293b" }}>知識ベース</label>
          <span style={{ fontSize: 12, color: "#64748b" }}>
            会社・サービスのウェブサイト URL を入力すると、AIが内容を参照して回答できるようになります。
          </span>
          <div style={{ display: "grid", gap: 6 }}>
            <label style={{ fontSize: 13, color: "#334155" }}>URL から読み込む</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                placeholder="https://example.com"
                value={knowledgeBaseUrl}
                onChange={(e) => setKnowledgeBaseUrl(e.target.value)}
                style={{ flex: 1, border: "1px solid #cbd5e1", borderRadius: 8, padding: "8px 10px", fontSize: 13 }}
              />
              <button
                type="button"
                disabled={scrapeLoading || !knowledgeBaseUrl.trim()}
                onClick={async () => {
                  setScrapeLoading(true);
                  setScrapeMessage("");
                  try {
                    const res = await fetch("/api/scrape", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ url: knowledgeBaseUrl.trim() })
                    });
                    const data = (await res.json()) as { text?: string; error?: string };
                    if (data.text) {
                      setKnowledgeBaseText(data.text);
                      setScrapeMessage(`読み込み完了（${data.text.length.toLocaleString()}文字）`);
                    } else {
                      setScrapeMessage(data.error ?? "読み込みに失敗しました");
                    }
                  } catch {
                    setScrapeMessage("ネットワークエラーが発生しました");
                  } finally {
                    setScrapeLoading(false);
                  }
                }}
                style={{
                  border: "1px solid #0f172a",
                  borderRadius: 8,
                  background: scrapeLoading ? "#64748b" : "#0f172a",
                  color: "#fff",
                  padding: "8px 14px",
                  fontSize: 13,
                  cursor: scrapeLoading ? "not-allowed" : "pointer",
                  whiteSpace: "nowrap"
                }}
              >
                {scrapeLoading ? "読み込み中..." : "読み込む"}
              </button>
            </div>
            {scrapeMessage && (
              <span style={{ fontSize: 12, color: scrapeMessage.includes("完了") ? "#16a34a" : "#dc2626" }}>
                {scrapeMessage}
              </span>
            )}
          </div>
          <div style={{ display: "grid", gap: 6 }}>
            <label style={{ fontSize: 13, color: "#334155" }}>テキスト（手動入力・補足）</label>
            <textarea
              rows={6}
              placeholder="会社・サービスの詳細情報をここに貼り付けることもできます"
              value={knowledgeBaseText}
              onChange={(e) => setKnowledgeBaseText(e.target.value)}
              style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "8px 10px", fontSize: 12, lineHeight: 1.6 }}
            />
          </div>
        </div>

        {/* TTS 読み方補正 */}
        <div style={{ display: "grid", gap: 10, borderTop: "1px solid #e2e8f0", paddingTop: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <label style={{ fontSize: 14, fontWeight: 700, color: "#1e293b" }}>読み方補正</label>
              <span style={{ fontSize: 12, color: "#64748b", marginLeft: 8 }}>
                読み方が違う単語を修正できます
              </span>
            </div>
            <button
              type="button"
              onClick={() => setTtsCorrections((prev) => [...prev, { term: "", reading: "" }])}
              style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "6px 12px", fontSize: 13, cursor: "pointer" }}
            >
              ＋ 追加
            </button>
          </div>
          {ttsCorrections.length === 0 && (
            <span style={{ fontSize: 12, color: "#94a3b8" }}>補正なし（右上の「＋ 追加」で行を追加）</span>
          )}
          {ttsCorrections.map((correction, index) => (
            <div key={index} style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                placeholder="単語（例: B'Me）"
                value={correction.term}
                onChange={(e) => setTtsCorrections((prev) => prev.map((c, i) => i === index ? { ...c, term: e.target.value } : c))}
                style={{ flex: 1, border: "1px solid #cbd5e1", borderRadius: 8, padding: "7px 10px", fontSize: 13 }}
              />
              <span style={{ color: "#94a3b8", fontSize: 14 }}>→</span>
              <input
                placeholder="読み方（例: びーみー）"
                value={correction.reading}
                onChange={(e) => setTtsCorrections((prev) => prev.map((c, i) => i === index ? { ...c, reading: e.target.value } : c))}
                style={{ flex: 1, border: "1px solid #cbd5e1", borderRadius: 8, padding: "7px 10px", fontSize: 13 }}
              />
              <button
                type="button"
                onClick={() => setTtsCorrections((prev) => prev.filter((_, i) => i !== index))}
                style={{ border: "none", background: "none", color: "#dc2626", cursor: "pointer", fontSize: 16, padding: "0 4px" }}
                aria-label="削除"
              >
                ×
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
        <div style={{ fontSize: 13, color: "#334155", fontWeight: 600 }}>
          感情ステータス別アバター挙動設定
          <span style={{ fontSize: 11, color: "#64748b", marginLeft: 8, fontWeight: 400 }}>
            ※会話内容に応じて内部的に適用（ユーザーには「受付中 / 聞き取り中 / 考え中 / 読み上げ中」の4状態のみ表示）
          </span>
        </div>
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
                  checked={currentMapping.expressionOptionIds.includes(option.id)}
                  onChange={() => toggleExpression(option.id)}
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
                  checked={currentMapping.gestureOptionIds.includes(option.id)}
                  onChange={() => toggleGesture(option.id)}
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
