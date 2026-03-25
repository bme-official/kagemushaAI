"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { characterConfig } from "@/config/character.config";
import { companyConfig } from "@/config/company.config";
import { avatarRuntimeConfig } from "@/config/avatar.runtime.config";
import { uiConfig } from "@/config/ui.config";
import { voiceConfig } from "@/config/voice.config";
import { VRMCanvas } from "@/components/avatar/VRMCanvas";
import { ChatInput } from "@/components/chat/ChatInput";
import { ConversationSummary } from "@/components/chat/ConversationSummary";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { StructuredFieldPrompt } from "@/components/chat/StructuredFieldPrompt";
import { InquiryConfirmCard } from "@/components/chat/InquiryConfirmCard";
import { VoiceControls } from "@/components/chat/VoiceControls";
import type { AvatarBehaviorState } from "@/types/avatar";
import type {
  ChatSessionState,
  ConversationMessage,
  StructuredFieldRequest
} from "@/types/chat";

const createInitialSession = (): ChatSessionState => {
  const initialMessages: ConversationMessage[] = [
    {
      id: crypto.randomUUID(),
      role: "assistant",
      kind: "text",
      // デフォルト設定で自己紹介付き挨拶を生成（設定ロード後はopeningMessageOverrideで上書き）
      content: `こんにちは、${companyConfig.name}のAIコンシェルジュ、${characterConfig.name}です。どのようなご相談でもお気軽にお聞かせください。`,
      createdAt: new Date().toISOString()
    }
  ];

  return {
    sessionId: crypto.randomUUID(),
    sourcePage: "/contact",
    phase: "collecting",
    inferredCategory: null,
    inferredIntent: null,
    urgency: "low",
    needsHuman: false,
    summaryDraft: "",
    messages: initialMessages,
    collectedFields: {}
  };
};

type ChatApiResponse = {
  session: ChatSessionState;
  assistantMessage: ConversationMessage;
  nextFieldRequest: StructuredFieldRequest | null;
};

const applyIdentityMention = (text: string, settings: RuntimeAvatarSettings) => {
  const serviceName = settings.services?.find((service) => service.name)?.name;
  const hasIdentityMention = [
    settings.avatarName,
    settings.companyName,
    serviceName
  ]
    .filter(Boolean)
    .some((token) => text.includes(token as string));
  if (hasIdentityMention) return text;
  if (/どのようなご相談ですか\??/.test(text)) {
    const companyName = settings.companyName;
    const avatarName = settings.avatarName;
    if (companyName && avatarName) {
      return `どのようなご相談でしょうか？ ${companyName}の${avatarName}が丁寧にお伺いします。`;
    }
    return "どのようなご相談でしょうか？ 丁寧にお伺いします。";
  }
  return text;
};

const normalizeAssistantText = (text: string, settings: RuntimeAvatarSettings) => {
  let next = text;
  if (settings.companyName) {
    next = next.replaceAll(companyConfig.name, settings.companyName);
  }
  if (settings.avatarName) {
    next = next.replaceAll(characterConfig.name, settings.avatarName);
  }
  return applyIdentityMention(next, settings);
};

/** TTS用: 表示名をよみがなに置換してTTSエンジンの発音を改善する */
const normalizeTtsText = (text: string, settings: RuntimeAvatarSettings): string => {
  let next = text;
  if (settings.companyName && settings.companyNameKana) {
    next = next.replaceAll(settings.companyName, settings.companyNameKana);
  }
  if (settings.avatarName && settings.avatarNameKana) {
    next = next.replaceAll(settings.avatarName, settings.avatarNameKana);
  }
  return next;
};

type ChatWindowProps = {
  sourcePage?: string;
  enableVoice?: boolean;
  initialAudioUnlocked?: boolean;
  initialAvatarSettings?: string;
};

const detectExpression = (
  latestAssistantMessage: ConversationMessage | undefined,
  urgency: ChatSessionState["urgency"]
): AvatarBehaviorState["expression"] => {
  if (urgency === "high") return "serious";
  const content = latestAssistantMessage?.content ?? "";
  if (/ありがとう|よかった|嬉しい|安心|承知しました/.test(content)) return "smile";
  if (/重要|至急|緊急|急ぎ/.test(content)) return "serious";
  if (/!|！/.test(content)) return "surprised";
  if (/確認|整理|検討/.test(content)) return "thinking";
  return "neutral";
};

type RuntimeAvatarSettings = {
  modelUrl?: string;
  avatarName?: string;
  avatarNameKana?: string;
  avatarAge?: string;
  companyName?: string;
  companyNameKana?: string;
  voiceModel?: string;
  ttsApiVoice?: string;
  profile?: string;
  statuses?: string[];
  statusMappings?: Record<
    string,
    {
      expressionOptionIds: string[];
      poses: AvatarBehaviorState["pose"][];
      gestureOptionIds: string[];
    }
  >;
  services?: Array<{
    name: string;
    ruby: string;
    description: string;
  }>;
};

const expressionOptionMap: Record<string, AvatarBehaviorState["expression"]> = {
  neutral_default: "neutral",
  smile_happy: "smile",
  serious_focus: "serious",
  surprised_alert: "surprised",
  thinking_deep: "thinking",
  smile_relief: "smile",
  serious_sad: "serious"
};

const gestureOptionMap: Record<string, AvatarBehaviorState["gesture"]> = {
  idle_wait: "idle",
  thinking_pose: "thinking",
  listening_default: "listening",
  explain_general: "explaining",
  emphasis_point: "emphasis",
  listening_empathy: "listening",
  explain_guide: "explaining",
  arm_cross: "armCross",
  wave_hand: "waveHand",
  point_finger: "pointFinger"
};

export const ChatWindow = ({
  sourcePage = "/contact",
  enableVoice = false,
  initialAudioUnlocked = false,
  initialAvatarSettings
}: ChatWindowProps) => {
  const [session, setSession] = useState<ChatSessionState>(() => {
    const initial = createInitialSession();
    return { ...initial, sourcePage };
  });
  const [isLoading, setIsLoading] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(
    enableVoice && voiceConfig.enabled && voiceConfig.autoSpeakAssistant
  );
  const [nextFieldRequest, setNextFieldRequest] = useState<StructuredFieldRequest | null>(
    null
  );
  const [viewMode, setViewMode] = useState<"voice" | "text">(enableVoice ? "voice" : "text");
  const [isListening, setIsListening] = useState(false);
  const [isSpeechDetected, setIsSpeechDetected] = useState(false);
  const [micEnabled, setMicEnabled] = useState(enableVoice && voiceConfig.enabled && voiceConfig.sttEnabled);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [assistantLipSyncActive, setAssistantLipSyncActive] = useState(false);
  const [isEmbedVisible, setIsEmbedVisible] = useState(true);
  const [audioUnlocked, setAudioUnlocked] = useState(initialAudioUnlocked || enableVoice);
  const [openingMessageOverride, setOpeningMessageOverride] = useState<string | null>(null);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [avatarNameDisplay, setAvatarNameDisplay] = useState(characterConfig.name);
  const [runtimeAvatarSettings, setRuntimeAvatarSettings] = useState<RuntimeAvatarSettings>({});
  const [avatarModelUrl, setAvatarModelUrl] = useState(avatarRuntimeConfig.modelUrl);
  const [avatarBehavior, setAvatarBehavior] = useState<AvatarBehaviorState>({
    pose: "neutral",
    gesture: "idle",
    voice: "muted",
    expression: "neutral",
    lipSyncActive: false,
    statusLabel: "ご相談受付中"
  });
  const lastSpokenMessageIdRef = useRef<string | null>(null);
  const assistantLipSyncTimerRef = useRef<number | null>(null);
  const apiAudioRef = useRef<HTMLAudioElement | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  // API TTS 呼び出し番号: 非同期フェッチ中に新しい呼び出しが来たら旧呼び出しを中断する
  const apiCallCounterRef = useRef(0);
  // ユーザーが最初のメッセージを送った後は設定再ロードでTTSを中断しない
  const conversationStartedRef = useRef(false);
  // runtimeAvatarSettings を常に最新値で参照するための ref（speakViaTtsApi クロージャ内でよみがな置換に使用）
  const runtimeAvatarSettingsRef = useRef(runtimeAvatarSettings);
  useEffect(() => { runtimeAvatarSettingsRef.current = runtimeAvatarSettings; }, [runtimeAvatarSettings]);
  // avatarModelUrl が変わるたびにロード中フラグを立てる
  useEffect(() => {
    if (canRenderVrm) setAvatarLoading(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [avatarModelUrl]);

  // TTS先行フェッチキャッシュ: postChat でAI応答受信直後にfetch開始し、useEffect発火時に再利用
  const ttsPrefetchRef = useRef<{
    text: string;
    voice: string;
    promise: Promise<Response | null>;
  } | null>(null);

  const stopApiAudio = useCallback(() => {
    const a = apiAudioRef.current;
    if (!a) return;
    a.pause();
    a.onplay = null;
    a.onended = null;
    a.onerror = null;
    try {
      if (a.src.startsWith("blob:")) URL.revokeObjectURL(a.src);
    } catch { /* ignore */ }
    apiAudioRef.current = null;
  }, []);

  const applyRuntimeSettings = useCallback((parsed: RuntimeAvatarSettings | null | undefined) => {
    if (!parsed) return;
    // services が空配列の場合は既存の設定を上書きしない（Supabase 側で空になっていても保持）
    setRuntimeAvatarSettings((prev) => ({
      ...prev,
      ...parsed,
      services: parsed.services?.length ? parsed.services : prev.services
    }));
    if (parsed.avatarName) {
      setAvatarNameDisplay(parsed.avatarName);
    }
    const runtimeCompany = parsed.companyName || "影武者AI";
    const runtimeName = parsed.avatarName || characterConfig.name;
    const primaryService = parsed.services?.find((s) => s.name)?.name;
    // サービス名を役職として使い「〇〇のAIコンシェルジュ、Leoです」形式にする
    const roleLabel = primaryService ?? "AIコンシェルジュ";
    const openingMessage = `こんにちは、${runtimeCompany}の${roleLabel}、${runtimeName}です。どのようなご相談でもお気軽にお聞かせください。`;
    // session.messages を変更せず表示用オーバーライドとして挨拶文を保持する
    // → session は postChat の setSession 上書きに左右されず履歴が変わらなくなる
    setOpeningMessageOverride(openingMessage);
    // 会話開始前のみ TTS をリセットして更新後の挨拶文を読み上げ直す
    if (!conversationStartedRef.current) {
      stopApiAudio();
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      lastSpokenMessageIdRef.current = null;
    }
    if (parsed.modelUrl) {
      setAvatarLoading(true);
      setAvatarModelUrl(parsed.modelUrl);
    } else {
      setAvatarModelUrl(avatarRuntimeConfig.modelUrl);
    }
  }, [stopApiAudio]);

  const messages = useMemo(() => session.messages, [session.messages]);
  const displayMessages = useMemo(
    () =>
      messages.map((message, index) => {
        if (message.role !== "assistant") return message;
        // 最初のアシスタントメッセージは設定由来の挨拶文オーバーライドを使用する
        // session.messages は変更せず表示層だけで上書きするため履歴が変わらない
        const baseContent = (index === 0 && openingMessageOverride)
          ? openingMessageOverride
          : message.content;
        return { ...message, content: normalizeAssistantText(baseContent, runtimeAvatarSettings) };
      }),
    [messages, runtimeAvatarSettings, openingMessageOverride]
  );
  const latestAssistant = useMemo(
    () => [...displayMessages].reverse().find((msg) => msg.role === "assistant"),
    [displayMessages]
  );
  const canRenderVrm =
    avatarRuntimeConfig.enabled && Boolean(avatarModelUrl) && avatarModelUrl.toLowerCase().endsWith(".vrm");

  const parseRuntimeSettings = useCallback((value: unknown): RuntimeAvatarSettings | null => {
    if (!value) return null;
    if (typeof value === "object") {
      return value as RuntimeAvatarSettings;
    }
    if (typeof value !== "string") return null;
    try {
      return JSON.parse(value) as RuntimeAvatarSettings;
    } catch {
      try {
        return JSON.parse(decodeURIComponent(value)) as RuntimeAvatarSettings;
      } catch {
        return null;
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleMessage = (event: MessageEvent<{
      type?: string;
      visible?: boolean;
      userGesture?: boolean;
      avatarSettings?: RuntimeAvatarSettings | string;
    }>) => {
      if (event.data?.type !== "kagemusha-chat-visibility") return;
      setIsEmbedVisible(Boolean(event.data.visible));
      if (event.data.userGesture) {
        setAudioUnlocked(true);
        if (typeof window !== "undefined" && "speechSynthesis" in window) {
          try {
            const primer = new SpeechSynthesisUtterance(" ");
            primer.volume = 0;
            window.speechSynthesis.speak(primer);
            window.speechSynthesis.resume();
          } catch {
            // ignore primer error
          }
        }
      }
      const parsed = parseRuntimeSettings(event.data.avatarSettings);
      if (parsed) {
        applyRuntimeSettings(parsed);
      }
    };
    window.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, [applyRuntimeSettings, parseRuntimeSettings]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (initialAvatarSettings) {
      const parsed = parseRuntimeSettings(initialAvatarSettings);
      if (parsed) applyRuntimeSettings(parsed);
    }
    const syncAvatarSettings = () => {
      try {
        const raw = window.localStorage.getItem("kagemusha-avatar-settings");
        if (!raw) return;
        const parsed = JSON.parse(raw) as RuntimeAvatarSettings;
        applyRuntimeSettings(parsed);
      } catch {
        // ignore local storage parse error
      }
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key && event.key !== "kagemusha-avatar-settings") return;
      syncAvatarSettings();
    };
    syncAvatarSettings();
    window.addEventListener("kagemusha-avatar-settings-updated", syncAvatarSettings);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("kagemusha-avatar-settings-updated", syncAvatarSettings);
      window.removeEventListener("storage", handleStorage);
    };
  }, [applyRuntimeSettings, initialAvatarSettings, parseRuntimeSettings]);

  useEffect(() => {
    let cancelled = false;
    const loadServerSettings = async () => {
      try {
        const response = await fetch("/api/avatar-settings", { cache: "no-store" });
        if (!response.ok) return;
        const data = (await response.json()) as { settings?: RuntimeAvatarSettings | null };
        if (cancelled || !data.settings) return;
        applyRuntimeSettings(data.settings);
      } catch {
        // ignore server settings error
      }
    };
    loadServerSettings();
    return () => {
      cancelled = true;
    };
  }, [applyRuntimeSettings]);

  useEffect(() => {
    if (isEmbedVisible) return;
    setIsSpeaking(false);
    setIsSpeechDetected(false);
    setAssistantLipSyncActive(false);
    stopApiAudio();
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }, [isEmbedVisible, stopApiAudio]);

  const pulseAssistantLipSync = useCallback(() => {
    setAssistantLipSyncActive(true);
    if (assistantLipSyncTimerRef.current !== null) {
      window.clearTimeout(assistantLipSyncTimerRef.current);
    }
    assistantLipSyncTimerRef.current = window.setTimeout(() => {
      setAssistantLipSyncActive(false);
      assistantLipSyncTimerRef.current = null;
    }, 140);
  }, []);

  const resolveStatusMapping = useCallback(
    (statusLabelCandidates: string[]) => {
      const mappings = runtimeAvatarSettings.statusMappings;
      if (!mappings) return null;
      const entries = Object.entries(mappings);
      for (const candidate of statusLabelCandidates) {
        const direct = mappings[candidate];
        if (direct) {
          return { status: candidate, mapping: direct };
        }
        const hit = entries.find(([key]) => key.includes(candidate) || candidate.includes(key));
        if (hit) {
          return { status: hit[0], mapping: hit[1] };
        }
      }
      return null;
    },
    [runtimeAvatarSettings.statusMappings]
  );

  const speakViaTtsApi = useCallback(
    async (
      text: string,
      handlers: {
        onStart: () => void;
        onBoundary: () => void;
        onEnd: () => void;
        onError: () => void;
        markAsSpokenId?: string;
      }
    ): Promise<void> => {
      // この呼び出しの番号を確保し、後続の呼び出しで上書きされたら中断する
      const myApiCall = ++apiCallCounterRef.current;
      stopApiAudio();
      try {
        // ref 経由で最新の設定を取得（stale closure によるよみがな未反映を防ぐ）
        const latestSettings = runtimeAvatarSettingsRef.current;
        const apiVoice = latestSettings.ttsApiVoice || "nova";
        const ttsText = normalizeTtsText(text, latestSettings).slice(0, 800);

        // 先行フェッチキャッシュがあれば再利用（postChatで先行開始済みのリクエスト）
        const prefetch = ttsPrefetchRef.current;
        let responsePromise: Promise<Response | null>;
        if (prefetch && prefetch.text === ttsText && prefetch.voice === apiVoice) {
          ttsPrefetchRef.current = null;
          responsePromise = prefetch.promise;
        } else {
          ttsPrefetchRef.current = null;
          responsePromise = fetch("/api/tts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: ttsText, voice: apiVoice })
          }).catch(() => null);
        }

        const response = await responsePromise;
        // フェッチ中に新しい呼び出しが来ていたら破棄
        if (apiCallCounterRef.current !== myApiCall) return;
        if (!response?.ok) {
          handlers.onError();
          return;
        }
        const blob = await response.blob();
        if (apiCallCounterRef.current !== myApiCall) {
          try { URL.revokeObjectURL(URL.createObjectURL(blob)); } catch { /* ignore */ }
          return;
        }
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        // iOS Safari で inline 再生するために必須
        audio.setAttribute("playsinline", "");
        audio.setAttribute("webkit-playsinline", "");
        apiAudioRef.current = audio;
        let lipSyncTimer: number | null = null;
        audio.onplay = () => {
          if (handlers.markAsSpokenId) {
            lastSpokenMessageIdRef.current = handlers.markAsSpokenId;
          }
          handlers.onStart();
          lipSyncTimer = window.setInterval(() => handlers.onBoundary(), 120);
        };
        audio.onended = () => {
          if (lipSyncTimer !== null) window.clearInterval(lipSyncTimer);
          try { URL.revokeObjectURL(url); } catch { /* ignore */ }
          if (apiAudioRef.current === audio) apiAudioRef.current = null;
          handlers.onEnd();
        };
        audio.onerror = () => {
          if (lipSyncTimer !== null) window.clearInterval(lipSyncTimer);
          try { URL.revokeObjectURL(url); } catch { /* ignore */ }
          if (apiAudioRef.current === audio) apiAudioRef.current = null;
          handlers.onError();
        };
        await audio.play();
      } catch {
        if (apiCallCounterRef.current === myApiCall) handlers.onError();
      }
    },
    [stopApiAudio]
  );

  const speakWithFallback = useCallback(
    (text: string, handlers: {
      onStart: () => void;
      onBoundary: () => void;
      onEnd: () => void;
      onError: () => void;
      markAsSpokenId?: string;
    }) => {
      // 既存の音声を必ず停止してから OpenAI TTS を使用（全ブラウザ・iOS で確実に動作）
      stopApiAudio();
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      void speakViaTtsApi(text, handlers);
    },
    [speakViaTtsApi, stopApiAudio]
  );

  const unlockAudio = useCallback(() => {
    if (!audioUnlocked) {
      setAudioUnlocked(true);
      // iOS Safari: 無音の Audio を再生してオーディオコンテキストをユーザージェスチャーで解放する
      try {
        const silent = new Audio();
        silent.setAttribute("playsinline", "");
        // 極小の無音 mp3（最短 Base64）
        silent.src =
          "data:audio/mpeg;base64,SUQzBAAAAAAA/+MYxAAAAANIAAAAAExBTUUzLjk4LjIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/+MYxDsAAANIAAAAAP/////////////////////////////////////////////////////////////////AADwP/////////////////////////////////////////////////////////////////A==";
        silent.volume = 0;
        silent.play().catch(() => {});
      } catch {
        // ignore
      }
    }
  }, [audioUnlocked]);


  // アシスタントの最新メッセージを1回だけ読み上げる（表示テキストと同一のlatestAssistant.contentを使用）
  useEffect(() => {
    if (!enableVoice || !voiceConfig.enabled || !ttsEnabled || !audioUnlocked) return;
    if (!isEmbedVisible) return;
    if (!latestAssistant) return;
    if (lastSpokenMessageIdRef.current === latestAssistant.id) return;
    // 既に読み上げ済みとしてマーク（重複防止）
    lastSpokenMessageIdRef.current = latestAssistant.id;

    // TTS API フェッチ前に即座に speaking 状態にして thinking→idle→speaking のギャップを防ぐ
    setIsSpeaking(true);
    pulseAssistantLipSync();

    speakWithFallback(latestAssistant.content, {
      onStart: () => {
        setIsSpeaking(true);
        pulseAssistantLipSync();
      },
      onBoundary: () => pulseAssistantLipSync(),
      onEnd: () => {
        setIsSpeaking(false);
        setAssistantLipSyncActive(false);
      },
      onError: () => {
        setIsSpeaking(false);
        setAssistantLipSyncActive(false);
        // 失敗時は再試行できるようにリセット
        lastSpokenMessageIdRef.current = null;
      },
      markAsSpokenId: latestAssistant.id
    });
  }, [audioUnlocked, enableVoice, isEmbedVisible, latestAssistant, pulseAssistantLipSync, speakWithFallback, ttsEnabled]);

  useEffect(() => {
    if (!initialAudioUnlocked || audioUnlocked) return;
    setAudioUnlocked(true);
  }, [audioUnlocked, initialAudioUnlocked]);

  useEffect(() => {
    if (!enableVoice || !voiceConfig.enabled || !ttsEnabled) {
      setIsSpeaking(false);
      setAssistantLipSyncActive(false);
      stopApiAudio();
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    }
  }, [enableVoice, stopApiAudio, ttsEnabled]);

  // ユーザーが話し始めたら即座にTTSを中断してlistening状態に切り替える
  useEffect(() => {
    if (!isSpeechDetected) return;
    stopApiAudio();
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
    if (assistantLipSyncTimerRef.current !== null) {
      window.clearTimeout(assistantLipSyncTimerRef.current);
      assistantLipSyncTimerRef.current = null;
    }
    setAssistantLipSyncActive(false);
    // 読み上げがキャンセルされたので次回の新しいメッセージは再び読み上げる
  }, [isSpeechDetected, stopApiAudio]);

  const handleVoiceTranscript = (text: string) => {
    // 読み上げ中でも文字起こし結果は必ず処理する。TTS は即座に停止して聞き取り優先。
    stopApiAudio();
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
    setAssistantLipSyncActive(false);
    void handleMessageSend(text);
  };

  useEffect(() => {
    return () => {
      if (assistantLipSyncTimerRef.current !== null) {
        window.clearTimeout(assistantLipSyncTimerRef.current);
      }
    };
  }, []);

  // 新しいメッセージが追加されたら常に最下部へスクロール（scrollTopを直接制御して確実に動作させる）
  useEffect(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [displayMessages.length]);

  useEffect(() => {
    const latestAssistantMessage = [...messages].reverse().find((msg) => msg.role === "assistant");
    const fallbackExpression = detectExpression(latestAssistantMessage, session.urgency);
    const voice: AvatarBehaviorState["voice"] = isSpeechDetected
      ? "listening"
      : isSpeaking
        ? "speaking"
        : "muted";

    const fallbackGesture: AvatarBehaviorState["gesture"] = isSpeechDetected
      ? "listening"
      : isLoading
        ? "thinking"
        : isSpeaking || isListening
          ? fallbackExpression === "serious"
            ? "emphasis"
            : "explaining"
          : "idle";

    // 表示ラベルは4状態のみ（感情ステータスは非表示・内部適用のみ）
    const fallbackStatusLabel = isSpeechDetected
      ? "listening..."
      : isSpeaking
        ? "speaking..."
        : isLoading
          ? "thinking..."
          : "idle";

    const fallbackPose: AvatarBehaviorState["pose"] = isSpeechDetected
      ? "leanForward"
      : isSpeaking
        ? "friendly"
        : isLoading
          ? "upright"
          : session.urgency === "high"
            ? "confident"
            : "neutral";

    const statusCandidates = isSpeechDetected
      ? ["聞き取り", "共感", "listening"]
      : isLoading
        ? ["考え中", "thinking"]
        : isSpeaking
          ? ["説明中", "案内", "speaking"]
          : fallbackExpression === "smile"
            ? ["嬉しい", "安心"]
            : fallbackExpression === "serious"
              ? ["緊張", "真剣", "悲しい"]
              : fallbackExpression === "thinking"
                ? ["考え中", "検討中"]
                : ["通常", "待機"];

    const resolved = resolveStatusMapping(statusCandidates);
    const resolvedExpression = resolved?.mapping.expressionOptionIds.length
      ? expressionOptionMap[resolved.mapping.expressionOptionIds[0]] ?? fallbackExpression
      : fallbackExpression;
    const resolvedGesture = resolved?.mapping.gestureOptionIds.length
      ? gestureOptionMap[resolved.mapping.gestureOptionIds[0]] ?? fallbackGesture
      : fallbackGesture;
    const resolvedPose = resolved?.mapping.poses.length ? resolved.mapping.poses[0] : fallbackPose;
    // アバターロード中は loading... を優先。感情ステータス名は非表示。
    const statusLabel = avatarLoading && canRenderVrm ? "loading..." : fallbackStatusLabel;
    const lipSyncActive = !isSpeechDetected && assistantLipSyncActive;
    const nextBehavior: AvatarBehaviorState = {
      pose: resolvedPose,
      gesture: resolvedGesture,
      voice,
      expression: resolvedExpression,
      lipSyncActive,
      statusLabel
    };
    setAvatarBehavior(nextBehavior);
  }, [
    assistantLipSyncActive,
    isListening,
    avatarLoading,
    canRenderVrm,
    isLoading,
    isSpeaking,
    isSpeechDetected,
    messages,
    resolveStatusMapping,
    session.urgency
  ]);

  const postChat = async (payload: {
    userInput?: string;
    fieldResponse?: { fieldName: string; value: string };
  }) => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session,
          inputMode: enableVoice ? "voice" : "text",
          avatarSettings: runtimeAvatarSettings,
          ...payload
        })
      });
      if (!response.ok) {
        const errorData = (await response.json()) as { message?: string };
        setSession((prev) => ({
          ...prev,
          messages: [
            ...prev.messages,
            {
              id: crypto.randomUUID(),
              role: "assistant",
              kind: "text",
              content: errorData.message ?? "入力内容をご確認ください。",
              createdAt: new Date().toISOString()
            }
          ]
        }));
        return;
      }
      const data = (await response.json()) as ChatApiResponse;
      const prefixedMessages = [...data.session.messages];
      const lastMessage = prefixedMessages[prefixedMessages.length - 1];
      if (lastMessage?.role === "assistant") {
        prefixedMessages[prefixedMessages.length - 1] = {
          ...lastMessage,
          content: normalizeAssistantText(lastMessage.content, runtimeAvatarSettings)
        };
      }

      // TTS先行フェッチ: Reactの再レンダーより前にTTS APIリクエストを開始して遅延を削減
      if (enableVoice && ttsEnabled && audioUnlocked && isEmbedVisible) {
        const ttsText = normalizeTtsText(
          prefixedMessages[prefixedMessages.length - 1]?.role === "assistant"
            ? prefixedMessages[prefixedMessages.length - 1].content
            : "",
          runtimeAvatarSettings
        ).slice(0, 800);
        const ttsVoice = runtimeAvatarSettings.ttsApiVoice || "nova";
        if (ttsText) {
          ttsPrefetchRef.current = {
            text: ttsText,
            voice: ttsVoice,
            promise: fetch("/api/tts", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ text: ttsText, voice: ttsVoice })
            }).catch(() => null)
          };
        }
      }

      setSession({
        ...data.session,
        messages: prefixedMessages
      });
      setNextFieldRequest(data.nextFieldRequest);
    } finally {
      setIsLoading(false);
    }
  };

  const submitInquiry = async () => {
    setIsLoading(true);
    try {
      await fetch("/api/inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session })
      });
      setSession((prev) => ({
        ...prev,
        phase: "completed",
        messages: [
          ...prev.messages,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            kind: "text",
            content: uiConfig.completeMessage,
            createdAt: new Date().toISOString()
          }
        ]
      }));
      setNextFieldRequest(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMessageSend = async (text: string) => {
    if (isLoading) return;
    conversationStartedRef.current = true;
    if (nextFieldRequest?.fieldName === "confirmSubmit") {
      const normalized = text.trim().toLowerCase();
      const confirmed = /^(yes|y|はい|送信|ok|お願いします)$/.test(normalized) ? "yes" : "no";
      await handleFieldSend(confirmed);
      return;
    }
    if (nextFieldRequest) {
      // フィールド入力は楽観的に表示してから送信
      setSession((prev) => ({
        ...prev,
        messages: [
          ...prev.messages,
          {
            id: crypto.randomUUID(),
            role: "user" as const,
            kind: "text" as const,
            content: text,
            createdAt: new Date().toISOString()
          }
        ]
      }));
      await postChat({
        fieldResponse: {
          fieldName: nextFieldRequest.fieldName,
          value: text
        }
      });
      return;
    }
    // ユーザーメッセージを楽観的に表示（サーバー応答前に即座に反映）
    setSession((prev) => ({
      ...prev,
      messages: [
        ...prev.messages,
        {
          id: crypto.randomUUID(),
          role: "user" as const,
          kind: "text" as const,
          content: text,
          createdAt: new Date().toISOString()
        }
      ]
    }));
    await postChat({ userInput: text });
  };

  const handleFieldSend = async (value: string) => {
    if (!nextFieldRequest) return;

    if (nextFieldRequest.fieldName === "confirmSubmit") {
      if (value === "yes") {
        await submitInquiry();
      } else {
        setNextFieldRequest(null);
      }
      return;
    }

    await postChat({
      fieldResponse: {
        fieldName: nextFieldRequest.fieldName,
        value
      }
    });
  };

  return (
    <section
      style={{ height: "100%", display: "flex", flexDirection: "column", position: "relative" }}
      onPointerDown={unlockAudio}
    >

      {enableVoice ? (
        <div
          style={{
            display: "flex",
            gap: 8,
            padding: "8px 12px",
            borderBottom: "1px solid #e2e8f0"
          }}
        >
          <button
            type="button"
            onClick={() => setViewMode("voice")}
            style={{
              border: "1px solid #cbd5e1",
              borderRadius: 8,
              padding: "6px 10px",
              background: viewMode === "voice" ? "#0f172a" : "#fff",
              color: viewMode === "voice" ? "#fff" : "#0f172a",
              cursor: "pointer"
            }}
          >
            ボイスチャット
          </button>
          <button
            type="button"
            onClick={() => setViewMode("text")}
            style={{
              border: "1px solid #cbd5e1",
              borderRadius: 8,
              padding: "6px 10px",
              background: viewMode === "text" ? "#0f172a" : "#fff",
              color: viewMode === "text" ? "#fff" : "#0f172a",
              cursor: "pointer"
            }}
          >
            テキストチャット
          </button>
        </div>
      ) : null}


      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", position: "relative" }}>
        {enableVoice ? (
          <div
            style={{
              flex: 1,
              minHeight: 0,
              position: "relative",
              padding: 12,
              display: viewMode === "voice" ? "block" : "none"
            }}
          >
            <div
              style={{
                height: "100%",
                border: "1px solid #e2e8f0",
                borderRadius: 10,
                overflow: "hidden",
                background: "#f8fafc",
                position: "relative"
              }}
            >
              {canRenderVrm ? (
                <VRMCanvas
                  modelUrl={avatarModelUrl}
                  behavior={avatarBehavior}
                  onModelReady={() => setAvatarLoading(false)}
                />
              ) : (
                <div
                  style={{
                    height: "100%",
                    display: "grid",
                    placeItems: "center",
                    color: "#64748b",
                    fontSize: 13
                  }}
                >
                  VRMモデルURLを設定すると音声会話画面にアバターを表示します。
                </div>
              )}
            </div>
          </div>
        ) : null}
        <div
          ref={messagesContainerRef}
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            padding: 12,
            display: viewMode === "text" || !enableVoice ? "flex" : "none",
            flexDirection: "column",
            gap: 8
          }}
        >
          {displayMessages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}
          {session.phase === "confirming" && session.summaryDraft ? (
            <ConversationSummary summary={session.summaryDraft} />
          ) : null}
        </div>
      </div>

      {enableVoice ? (
        <VoiceControls
          disabled={!isEmbedVisible}
          onTranscript={handleVoiceTranscript}
          micEnabled={micEnabled}
          onToggleMic={setMicEnabled}
          ttsEnabled={ttsEnabled}
          onToggleTts={setTtsEnabled}
          onListeningChange={setIsListening}
          onSpeechDetectedChange={setIsSpeechDetected}
          onUserInteraction={unlockAudio}
          mode={viewMode === "voice" ? "overlay" : "inline"}
          statusLabel={avatarBehavior.statusLabel}
        />
      ) : null}

      {/* ボイスモードのヒアリング入力欄: 完了後は非表示 */}
      {session.phase !== "completed" && nextFieldRequest && viewMode === "voice" && enableVoice ? (
        <div
          style={{
            position: "absolute",
            left: 12,
            right: 12,
            bottom: 74,
            zIndex: 21
          }}
        >
          {nextFieldRequest.fieldName === "confirmSubmit" ? (
            <InquiryConfirmCard
              collectedFields={session.collectedFields}
              onConfirm={() => handleFieldSend("yes")}
              onEdit={() => handleFieldSend("no")}
              disabled={isLoading}
            />
          ) : (
            <StructuredFieldPrompt
              request={nextFieldRequest}
              onSubmit={handleFieldSend}
              onSkip={!nextFieldRequest.required ? () => handleFieldSend("") : undefined}
              disabled={isLoading}
            />
          )}
        </div>
      ) : null}

      {/* テキスト入力欄: 完了後も表示したままにする */}
      <>
        {(viewMode === "text" || !enableVoice) && !isLoading ? (
            <ChatInput
              onSend={handleMessageSend}
              disabled={isLoading}
              placeholder={
                session.phase === "completed"
                  ? "引き続きお気軽にご質問ください"
                  : nextFieldRequest?.fieldName === "confirmSubmit"
                    ? "送信する場合は「はい」、修正する場合は「いいえ」と入力"
                    : nextFieldRequest
                      ? `【${nextFieldRequest.label}】を入力してください`
                      : "例) WEB制作の見積もりを相談したいです"
              }
            />
          ) : null}
      </>
    </section>
  );
};
