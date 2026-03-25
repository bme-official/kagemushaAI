"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { characterConfig } from "@/config/character.config";
import { companyConfig } from "@/config/company.config";
import { avatarRuntimeConfig } from "@/config/avatar.runtime.config";
import { uiConfig } from "@/config/ui.config";
import { voiceConfig } from "@/config/voice.config";
import { AvatarShell } from "@/components/avatar/AvatarShell";
import { AvatarStatus } from "@/components/avatar/AvatarStatus";
import { VRMCanvas } from "@/components/avatar/VRMCanvas";
import { ChatInput } from "@/components/chat/ChatInput";
import { ConversationSummary } from "@/components/chat/ConversationSummary";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { StructuredFieldPrompt } from "@/components/chat/StructuredFieldPrompt";
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
      content: characterConfig.greeting,
      createdAt: new Date().toISOString()
    },
    {
      id: crypto.randomUUID(),
      role: "assistant",
      kind: "text",
      content: uiConfig.initialQuestion,
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
  const [avatarReady, setAvatarReady] = useState(false);
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
  // 世代カウンター: 古い TTS 呼び出しが API フォールバックを起動するのを防ぐ
  const ttsGenerationRef = useRef(0);
  // API TTS 呼び出し番号: 非同期フェッチ中に新しい呼び出しが来たら旧呼び出しを中断する
  const apiCallCounterRef = useRef(0);

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
    setRuntimeAvatarSettings(parsed);
    if (parsed.avatarName) {
      setAvatarNameDisplay(parsed.avatarName);
    }
    const runtimeCompany = parsed.companyName || "影武者AI";
    const runtimeName = parsed.avatarName || characterConfig.name;
    const primaryService = parsed.services?.find((s) => s.name)?.name;
    const serviceSuffix = primaryService ? `主なご案内サービスは「${primaryService}」です。` : "";
    const openingMessage = `こんにちは、${runtimeCompany}のお問い合わせサポート担当 ${runtimeName} です。${serviceSuffix}ご相談内容を整理しながらご案内します。`;
    setSession((prev) => {
      if (!prev.messages.length) return prev;
      const first = prev.messages[0];
      if (first.role !== "assistant") return prev;
      if (prev.phase !== "collecting") return prev;
      return {
        ...prev,
        messages: [{ ...first, content: openingMessage }, ...prev.messages.slice(1)]
      };
    });
    if (parsed.modelUrl) {
      setAvatarReady(false);
      setAvatarModelUrl(parsed.modelUrl);
    } else {
      setAvatarModelUrl(avatarRuntimeConfig.modelUrl);
    }
  }, []);

  const messages = useMemo(() => session.messages, [session.messages]);
  const displayMessages = useMemo(
    () =>
      messages.map((message) =>
        message.role === "assistant"
          ? { ...message, content: normalizeAssistantText(message.content, runtimeAvatarSettings) }
          : message
      ),
    [messages, runtimeAvatarSettings]
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

  const applyConfiguredVoice = useCallback((utterance: SpeechSynthesisUtterance) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const voices = window.speechSynthesis.getVoices();
    const preferred = runtimeAvatarSettings.voiceModel?.toLowerCase();
    const voice =
      (preferred
        ? voices.find((item) => item.name.toLowerCase().includes(preferred))
        : undefined) ??
      voices.find((item) => item.lang.toLowerCase().startsWith(voiceConfig.locale.toLowerCase())) ??
      voices.find((item) => item.lang.toLowerCase().startsWith("ja")) ??
      voices[0];
    if (voice) {
      utterance.voice = voice;
    }
    // 企業名の読みがなを設定している場合は読み替える（ブラウザTTSの発音改善）
    if (runtimeAvatarSettings.companyName && runtimeAvatarSettings.companyNameKana) {
      utterance.text = utterance.text.replaceAll(
        runtimeAvatarSettings.companyName,
        runtimeAvatarSettings.companyNameKana
      );
    }
    // アバター名（表示名）も読みがなに置換する
    if (runtimeAvatarSettings.avatarName && runtimeAvatarSettings.avatarNameKana) {
      utterance.text = utterance.text.replaceAll(
        runtimeAvatarSettings.avatarName,
        runtimeAvatarSettings.avatarNameKana
      );
    } else if (runtimeAvatarSettings.avatarNameKana) {
      utterance.text = utterance.text.replaceAll(characterConfig.name, runtimeAvatarSettings.avatarNameKana);
    }
  }, [
    runtimeAvatarSettings.avatarName,
    runtimeAvatarSettings.avatarNameKana,
    runtimeAvatarSettings.companyName,
    runtimeAvatarSettings.companyNameKana,
    runtimeAvatarSettings.voiceModel
  ]);

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
        const apiVoice = runtimeAvatarSettings.ttsApiVoice || "nova";
        const response = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: text.slice(0, 800), voice: apiVoice })
        });
        // フェッチ中に新しい呼び出しが来ていたら破棄
        if (apiCallCounterRef.current !== myApiCall) return;
        if (!response.ok) {
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
    [stopApiAudio, runtimeAvatarSettings.ttsApiVoice]
  );

  const speakWithFallback = useCallback(
    (text: string, handlers: {
      onStart: () => void;
      onBoundary: () => void;
      onEnd: () => void;
      onError: () => void;
      markAsSpokenId?: string;
    }) => {
      // 既存の API 音声を必ず停止
      stopApiAudio();
      // ブラウザ TTS が使えない場合は即座に API TTS へ
      if (typeof window === "undefined" || !("speechSynthesis" in window)) {
        ++ttsGenerationRef.current; // gen を進めて旧呼び出しを無効化
        void speakViaTtsApi(text, handlers);
        return;
      }
      // 世代カウンターを進め、後続の新しい呼び出しが来たら古い呼び出しのAPIフォールバックを無効化
      const myGen = ++ttsGenerationRef.current;
      let started = false;
      let startTimeout: number | null = null;
      // タイムアウトまたは onerror のどちらか一方だけが API TTS を呼ぶ
      let apiTriggered = false;
      const buildUtterance = (withConfiguredVoice: boolean) => {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = voiceConfig.locale;
        utterance.rate = voiceConfig.speechRate;
        utterance.pitch = voiceConfig.speechPitch;
        if (withConfiguredVoice) {
          applyConfiguredVoice(utterance);
        }
        utterance.onstart = () => {
          started = true;
          if (startTimeout !== null) {
            window.clearTimeout(startTimeout);
            startTimeout = null;
          }
          if (handlers.markAsSpokenId) {
            lastSpokenMessageIdRef.current = handlers.markAsSpokenId;
          }
          handlers.onStart();
        };
        utterance.onboundary = handlers.onBoundary;
        utterance.onend = () => {
          if (startTimeout !== null) {
            window.clearTimeout(startTimeout);
            startTimeout = null;
          }
          handlers.onEnd();
        };
        return utterance;
      };

      window.speechSynthesis.cancel();
      window.speechSynthesis.resume();

      const first = buildUtterance(true);
      // ブラウザ TTS がエラー → API TTS にフォールバック
      // cancel()によるonerrorと startTimeout の両方が呼ばれないように apiTriggered で防護
      first.onerror = () => {
        if (startTimeout !== null) {
          window.clearTimeout(startTimeout);
          startTimeout = null;
        }
        if (started) return; // 再生開始後のキャンセルはフォールバック不要
        if (ttsGenerationRef.current !== myGen) return; // 新しい呼び出しに置き換え済み
        if (apiTriggered) return; // タイムアウトが既に API TTS を起動済み
        apiTriggered = true;
        void speakViaTtsApi(text, handlers);
      };
      window.speechSynthesis.speak(first);
      // 1.2 秒以内に onstart が来なければ API TTS にフォールバック
      startTimeout = window.setTimeout(() => {
        if (started) return;
        if (ttsGenerationRef.current !== myGen) return; // 新しい呼び出しに置き換え済み
        apiTriggered = true; // cancel() が onerror を発火しても二重呼び出しを防ぐ
        window.speechSynthesis.cancel();
        void speakViaTtsApi(text, handlers);
      }, 1200);
    },
    [applyConfiguredVoice, speakViaTtsApi, stopApiAudio]
  );

  const unlockAudio = useCallback(() => {
    if (!audioUnlocked) {
      setAudioUnlocked(true);
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
    if (isSpeaking && !isSpeechDetected) return;
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

    const fallbackStatusLabel = isSpeechDetected
      ? "音声を聞き取り中..."
      : isSpeaking
        ? "回答を読み上げ中..."
        : isLoading
          ? "入力内容を整理中..."
          : session.urgency === "high"
            ? "優先度高めで確認中"
            : "ご相談受付中";

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
    const statusLabel = resolved?.status ?? fallbackStatusLabel;
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
    if (nextFieldRequest?.fieldName === "confirmSubmit") {
      const normalized = text.trim().toLowerCase();
      const confirmed = /^(yes|y|はい|送信|ok|お願いします)$/.test(normalized) ? "yes" : "no";
      await handleFieldSend(confirmed);
      return;
    }
    if (nextFieldRequest) {
      await postChat({
        fieldResponse: {
          fieldName: nextFieldRequest.fieldName,
          value: text
        }
      });
      return;
    }
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
      <div
        style={{
          padding: 12,
          borderBottom: "1px solid #e2e8f0",
          display: "flex",
          gap: 8,
          alignItems: "center"
        }}
      >
        <AvatarShell
          placeholderText={(
            runtimeAvatarSettings.avatarName ||
            avatarNameDisplay ||
            characterConfig.avatar.placeholderText
          )
            .slice(0, 3)
            .toUpperCase()}
        />
        <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.2 }}>
          <strong style={{ fontSize: 14 }}>{avatarNameDisplay}</strong>
          <AvatarStatus statusLabel={avatarBehavior.statusLabel} />
        </div>
      </div>

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
                  onModelReady={() => setAvatarReady(true)}
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
          style={{
            flex: 1,
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
        />
      ) : null}

      {session.phase === "completed" ? null : (
        <>
          {nextFieldRequest && viewMode === "voice" ? (
            enableVoice ? (
              <div
                style={{
                  position: "absolute",
                  left: 12,
                  right: 12,
                  bottom: 74,
                  zIndex: 21,
                  borderRadius: 10,
                  overflow: "hidden",
                  boxShadow: "0 10px 28px rgba(15,23,42,.24)"
                }}
              >
                <StructuredFieldPrompt
                  request={nextFieldRequest}
                  onSubmit={handleFieldSend}
                  disabled={isLoading}
                />
              </div>
            ) : null
          ) : null}
          {(viewMode === "text" || !enableVoice) && !isLoading ? (
            <ChatInput
              onSend={handleMessageSend}
              disabled={isLoading}
              placeholder={
                nextFieldRequest?.fieldName === "confirmSubmit"
                  ? "送信する場合は「はい」、修正する場合は「いいえ」と入力"
                  : nextFieldRequest
                    ? `【${nextFieldRequest.label}】を入力してください`
                    : "例) WEB制作の見積もりを相談したいです"
              }
            />
          ) : null}
        </>
      )}
    </section>
  );
};
