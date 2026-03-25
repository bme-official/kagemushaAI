"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { voiceConfig } from "@/config/voice.config";
import { MicIcon, SpeakerIcon } from "@/components/chat/VoiceIcons";

type SpeechRecognitionAlternativeLike = {
  transcript: string;
};

type SpeechRecognitionResultLike = {
  [index: number]: SpeechRecognitionAlternativeLike;
  isFinal?: boolean;
};

type SpeechRecognitionEventLike = Event & {
  resultIndex?: number;
  results: {
    length: number;
    [index: number]: SpeechRecognitionResultLike;
  };
};

type BrowserSpeechRecognition = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous?: boolean;
  onstart?: (() => void) | null;
  onspeechstart?: (() => void) | null;
  onspeechend?: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event?: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

type SpeechWindow = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
};

type VoiceControlsProps = {
  disabled?: boolean;
  onTranscript: (text: string) => void;
  micEnabled: boolean;
  onToggleMic: (enabled: boolean) => void;
  ttsEnabled: boolean;
  onToggleTts: (enabled: boolean) => void;
  onListeningChange?: (listening: boolean) => void;
  onSpeechDetectedChange?: (speaking: boolean) => void;
  onUserInteraction?: () => void;
  mode?: "overlay" | "inline";
  statusLabel?: string;
  /** iOS TTS再生中フラグ: true の間はマイクを停止してエコーを防ぐ */
  isTtsSpeaking?: boolean;
};

export const VoiceControls = ({
  disabled,
  onTranscript,
  micEnabled,
  onToggleMic,
  ttsEnabled,
  onToggleTts,
  onListeningChange,
  onSpeechDetectedChange,
  onUserInteraction,
  mode = "overlay",
  statusLabel = "idle",
  isTtsSpeaking = false
}: VoiceControlsProps) => {
  const [isSpeechDetected, setIsSpeechDetected] = useState(false);
  const [unsupportedMessage, setUnsupportedMessage] = useState("");
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const shouldKeepListeningRef = useRef(false);
  // onstart が発火したかどうかのフラグ。発火しないまま onend が来たら許可ダイアログ後の失敗と判定
  const recognitionStartedRef = useRef(false);
  // TTS 再生中に一時停止したかどうかのフラグ（エコー対策）
  const suppressedForTtsRef = useRef(false);
  const restartTimeoutRef = useRef<number | null>(null);
  const speechIdleTimeoutRef = useRef<number | null>(null);

  // iOS Safari では recognition.start() をユーザージェスチャー内で同期的に呼ぶ必要がある。
  // useMemo で初期評価（SSR時は false）。
  const isIOS = useMemo(() => {
    if (typeof navigator === "undefined") return false;
    return /iphone|ipad|ipod/i.test(navigator.userAgent);
  }, []);

  // コールバック ref: recognition が古いクロージャを保持しても常に最新版を呼ぶ
  // （再レンダーで session が更新された handleVoiceTranscript を確実に使用する）
  const callbacksRef = useRef({ onTranscript, onListeningChange, onSpeechDetectedChange, onToggleMic });
  useEffect(() => {
    callbacksRef.current = { onTranscript, onListeningChange, onSpeechDetectedChange, onToggleMic };
  });

  const hasSpeechRecognition = useMemo(() => {
    if (typeof window === "undefined") return false;
    const speechWindow = window as SpeechWindow;
    return Boolean(speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition);
  }, []);

  const clearRestartTimer = () => {
    if (restartTimeoutRef.current !== null) {
      window.clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }
  };

  const clearSpeechIdleTimer = () => {
    if (speechIdleTimeoutRef.current !== null) {
      window.clearTimeout(speechIdleTimeoutRef.current);
      speechIdleTimeoutRef.current = null;
    }
  };

  const markSpeechDetected = () => {
    setIsSpeechDetected(true);
    callbacksRef.current.onSpeechDetectedChange?.(true);
    clearSpeechIdleTimer();
    speechIdleTimeoutRef.current = window.setTimeout(() => {
      setIsSpeechDetected(false);
      callbacksRef.current.onSpeechDetectedChange?.(false);
      speechIdleTimeoutRef.current = null;
    }, 400);
  };

  // 雑音と判定しないよう、実際の発話テキストが取得されてから親に通知する（TTSを止める）
  const confirmSpeechDetected = () => {
    setIsSpeechDetected(true);
    callbacksRef.current.onSpeechDetectedChange?.(true);
    clearSpeechIdleTimer();
    speechIdleTimeoutRef.current = window.setTimeout(() => {
      setIsSpeechDetected(false);
      callbacksRef.current.onSpeechDetectedChange?.(false);
      speechIdleTimeoutRef.current = null;
    }, 400);
  };

  const startListening = () => {
    setUnsupportedMessage("");
    if (!hasSpeechRecognition) {
      setUnsupportedMessage("このブラウザは音声入力に対応していません。");
      return;
    }
    const speechWindow = window as SpeechWindow;
    const Recognition =
      speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!Recognition) {
      setUnsupportedMessage("このブラウザは音声入力に対応していません。");
      return;
    }
    // 既存インスタンスが残っている場合は明示的に停止してから再生成する
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }
    // continuous:true にすることで onend からの再起動（ジェスチャー要件あり）を避ける。
    // iOS でも continuous:true を使用し、セッションが自然に終了した場合のみ onend で再起動する。
    const recognition = new Recognition();
    recognition.lang = voiceConfig.locale;
    recognition.interimResults = true; // 暫定テキストで雑音と実発話を区別
    recognition.maxAlternatives = 1;
    recognition.continuous = true; // iOS 含め continuous:true（再起動頻度を減らす）
    // 新しいセッション開始時にリセット（onend で onstart 未発火を検出するため）
    recognitionStartedRef.current = false;
    recognition.onstart = () => {
      recognitionStartedRef.current = true;
      setUnsupportedMessage("");
      callbacksRef.current.onListeningChange?.(true);
    };
    recognition.onspeechstart = () => {
      // onspeechstart は雑音でも発火するため、ローカルの視覚表示のみ更新
      // 親コンポーネント（TTS停止）への通知は実テキスト取得後に行う
      setIsSpeechDetected(true);
      clearSpeechIdleTimer();
    };
    recognition.onspeechend = () => {
      // 発話終了直後のブツ切れ感を避けるため、少し余韻を残して停止
      clearSpeechIdleTimer();
      speechIdleTimeoutRef.current = window.setTimeout(() => {
        setIsSpeechDetected(false);
        callbacksRef.current.onSpeechDetectedChange?.(false);
        speechIdleTimeoutRef.current = null;
      }, 120);
    };

    recognition.onresult = (event) => {
      const results = event?.results;
      if (!results) return;
      // 新しく届いた結果のみ処理（resultIndex から末尾まで）
      const startIdx = event.resultIndex ?? Math.max(0, results.length - 1);
      for (let i = startIdx; i < results.length; i++) {
        const result = results[i];
        const transcript = result?.[0]?.transcript?.trim() ?? "";
        if (!transcript) continue;
        if (!result.isFinal) {
          // 暫定テキストあり = 実際の発話を確認 → TTS停止を親に通知
          confirmSpeechDetected();
        } else {
          // 確定テキスト = 常に最新の onTranscript を呼ぶ（stale closure を避けるため ref 経由）
          markSpeechDetected();
          callbacksRef.current.onTranscript(transcript);
        }
      }
    };
    recognition.onerror = (event) => {
      clearSpeechIdleTimer();
      setIsSpeechDetected(false);
      callbacksRef.current.onListeningChange?.(false);
      callbacksRef.current.onSpeechDetectedChange?.(false);
      const err = event?.error;
      if (err === "not-allowed" || err === "audio-capture") {
        // 明確なパーミッション拒否 → 再試行しない
        shouldKeepListeningRef.current = false;
        setUnsupportedMessage("マイク権限が許可されていません。ブラウザ設定をご確認ください。");
      } else if (err === "service-not-allowed") {
        // iOS: ジェスチャー外で呼ばれた or 許可ダイアログ後に認識が開始できなかった。
        // マイクを OFF に戻して再タップを促す。
        shouldKeepListeningRef.current = false;
        callbacksRef.current.onToggleMic(false);
        setUnsupportedMessage("マイクボタンをもう一度タップしてください。");
      }
      // network / aborted / no-speech などは onend で再起動される
    };
    recognition.onend = () => {
      clearSpeechIdleTimer();
      setIsSpeechDetected(false);
      callbacksRef.current.onListeningChange?.(false);
      callbacksRef.current.onSpeechDetectedChange?.(false);
      if (suppressedForTtsRef.current) return; // TTS 抑制中は再起動しない
      if (shouldKeepListeningRef.current && !disabled) {
        // onstart が発火しないまま onend が来た = 許可ダイアログ後に認識が開始されなかったケース
        // ジェスチャー文脈が失われているため自動再起動できない。マイクを OFF にして再タップを促す。
        if (!recognitionStartedRef.current) {
          shouldKeepListeningRef.current = false;
          callbacksRef.current.onToggleMic(false);
          setUnsupportedMessage("マイクボタンをもう一度タップしてください。");
          return;
        }
        clearRestartTimer();
        const restartDelay = /iphone|ipad|ipod/i.test(navigator.userAgent) ? 300 : 80;
        restartTimeoutRef.current = window.setTimeout(() => {
          startListening();
        }, restartDelay);
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      setUnsupportedMessage("マイクを開始できませんでした。もう一度お試しください。");
      onListeningChange?.(false);
    }
  };

  const stopListening = () => {
    clearRestartTimer();
    clearSpeechIdleTimer();
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsSpeechDetected(false);
    onListeningChange?.(false);
    onSpeechDetectedChange?.(false);
  };

  useEffect(() => {
    if (!voiceConfig.enabled || !voiceConfig.sttEnabled) return;
    shouldKeepListeningRef.current = micEnabled && !disabled;

    if (micEnabled && !disabled) {
      // iOS: recognition.start() はユーザージェスチャー内（マイクボタン onClick）で
      // 同期的に呼ばれるため、useEffect からは呼ばない（非同期になりジェスチャー要件を満たせない）。
      // 非 iOS はジェスチャー不要なので useEffect から自動起動する。
      if (!isIOS) {
        startListening();
      }
      // iOS の場合: マイクボタン click ハンドラで直接 startListening() を呼ぶ（後述）
    } else {
      // 明示的に停止するときのみ止める（クリーンアップで止めない）
      shouldKeepListeningRef.current = false;
      stopListening();
    }
    // クリーンアップで stopListening() を呼ぶと「ON になった直後」の
    // React エフェクト入れ替えで認識が止まってしまうため省略する。
    // アンマウント時は別途専用エフェクトで止める。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [micEnabled, disabled, isIOS]);

  // iOS: TTS 再生中はマイクを一時停止してエコー（スピーカー音をマイクが拾う）を防ぐ
  useEffect(() => {
    if (!isIOS) return;
    if (isTtsSpeaking) {
      // TTS 開始 → 認識を一時停止
      suppressedForTtsRef.current = true;
      clearRestartTimer();
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch { /* ignore */ }
      }
    } else if (suppressedForTtsRef.current) {
      // TTS 終了 → 残響が収まるのを待ってから再開 (600ms)
      suppressedForTtsRef.current = false;
      if (micEnabled && !disabled) {
        clearRestartTimer();
        restartTimeoutRef.current = window.setTimeout(() => {
          if (!suppressedForTtsRef.current) {
            startListening();
          }
        }, 600);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTtsSpeaking, isIOS]);

  // アンマウント時のみ停止（エフェクト入れ替え時に止まらないよう分離）
  useEffect(() => {
    return () => {
      shouldKeepListeningRef.current = false;
      clearRestartTimer();
      clearSpeechIdleTimer();
      recognitionRef.current?.stop();
      recognitionRef.current = null;
    };
  }, []);

  if (!voiceConfig.enabled) return null;

  // ステータスごとのバー色とラベル色
  const isLoading = statusLabel === "loading...";
  const isListening = statusLabel === "listening...";
  const isThinking = statusLabel === "thinking...";
  const isSpeaking = statusLabel === "speaking...";

  const barColor = isListening ? "#22c55e" : isSpeaking ? "#3b82f6" : "#94a3b8";
  const labelColor = isListening ? "#16a34a" : isSpeaking ? "#2563eb" : "#94a3b8";

  const getBarStyle = (idx: number): React.CSSProperties => {
    if (isListening || isSpeaking) {
      const heights = [8, 14, 10];
      const duration = isListening ? 650 : 580;
      const stagger = isListening ? 90 : 75;
      return {
        width: 4,
        borderRadius: 999,
        height: heights[idx],
        background: barColor,
        transformOrigin: "bottom center",
        animation: `kagemushaBarBounce ${duration}ms ease-in-out ${idx * stagger}ms infinite alternate`
      };
    }
    if (isThinking || isLoading) {
      return {
        width: 4,
        borderRadius: 999,
        height: 7,
        background: "#94a3b8",
        transformOrigin: "center",
        animation: `kagemushaBarThink 1.4s ease-in-out ${idx * 380}ms infinite`
      };
    }
    // idle
    return {
      width: 4,
      borderRadius: 999,
      height: [8, 12, 9][idx],
      background: "#cbd5e1",
      transition: "all 200ms ease"
    };
  };

  return (
    <div
      style={{
        position: mode === "overlay" ? "absolute" : "relative",
        left: mode === "overlay" ? 12 : undefined,
        right: mode === "overlay" ? 12 : undefined,
        bottom: mode === "overlay" ? 12 : undefined,
        zIndex: mode === "overlay" ? 20 : undefined,
        padding: mode === "inline" ? "10px 12px" : "8px 12px",
        borderTop: mode === "inline" ? "1px solid #e2e8f0" : undefined,
        borderRadius: mode === "overlay" ? 12 : 0,
        background: mode === "overlay" ? "rgba(255,255,255,0.92)" : "#ffffff",
        backdropFilter: mode === "overlay" ? "blur(6px)" : undefined,
        display: "grid",
        gridTemplateColumns: "1fr auto 1fr",
        alignItems: "center",
        gap: 8
      }}
    >
      {/* 左：ステータスラベル */}
      <span
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: labelColor,
          letterSpacing: "0.02em",
          transition: "color 200ms ease",
          whiteSpace: "nowrap"
        }}
      >
        {statusLabel}
      </span>

      {/* 中央：3本バー */}
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 5,
          height: 20
        }}
      >
        {[0, 1, 2].map((idx) => (
          <span key={idx} style={getBarStyle(idx)} />
        ))}
      </div>

      {/* 右：マイク＋スピーカーボタン */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          justifyContent: "flex-end"
        }}
      >
        <button
          type="button"
          onClick={() => {
            const newEnabled = !micEnabled;
            onUserInteraction?.();
            onToggleMic(newEnabled);
            if (newEnabled && isIOS) {
              shouldKeepListeningRef.current = true;
              // iOS: recognition.start() はジェスチャー内で同期的に呼ぶ必要がある。
              // getUserMedia().then() のような非同期コールバックではジェスチャー文脈が
              // 失われて service-not-allowed エラーになるため、直接起動する。
              // SpeechRecognition.start() が初回の場合は iOS が自動でマイク許可ダイアログを表示する。
              startListening();
            }
          }}
          disabled={disabled || !voiceConfig.sttEnabled}
          aria-label="音声入力の切り替え"
          style={{
            width: 40,
            height: 40,
            borderRadius: 999,
            border: "none",
            background: "none",
            color: micEnabled ? "#0f172a" : "#dc2626",
            display: "grid",
            placeItems: "center",
            cursor: "pointer"
          }}
        >
          <MicIcon muted={!micEnabled} />
        </button>
        <button
          type="button"
          onClick={() => {
            onUserInteraction?.();
            onToggleTts(!ttsEnabled);
          }}
          disabled={disabled || !voiceConfig.ttsEnabled}
          aria-label="読み上げの切り替え"
          style={{
            width: 40,
            height: 40,
            borderRadius: 999,
            border: "none",
            background: "none",
            color: ttsEnabled ? "#0f172a" : "#dc2626",
            display: "grid",
            placeItems: "center",
            cursor: "pointer"
          }}
        >
          <SpeakerIcon muted={!ttsEnabled} />
        </button>
      </div>

      <style>{`
        @keyframes kagemushaBarBounce {
          from { transform: scaleY(1); opacity: 0.7; }
          to   { transform: scaleY(1.9); transform-origin: center; opacity: 1; }
        }
        @keyframes kagemushaBarThink {
          0%, 100% { opacity: 0.3; background: #e2e8f0; transform: scaleY(0.7); }
          50%       { opacity: 1;   background: #64748b; transform: scaleY(1.25); }
        }
      `}</style>

      {unsupportedMessage ? (
        <span
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 54,
            fontSize: 12,
            color: "#b45309",
            textAlign: "center"
          }}
        >
          {unsupportedMessage}
        </span>
      ) : null}
    </div>
  );
};
