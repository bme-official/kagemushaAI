"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { voiceConfig } from "@/config/voice.config";
import { MicIcon, SpeakerIcon } from "@/components/chat/VoiceIcons";

type SpeechRecognitionAlternativeLike = {
  transcript: string;
};

type SpeechRecognitionResultLike = {
  [index: number]: SpeechRecognitionAlternativeLike;
};

type SpeechRecognitionEventLike = Event & {
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
  onsoundstart?: (() => void) | null;
  onsoundend?: (() => void) | null;
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
  mode = "overlay"
}: VoiceControlsProps) => {
  const [isSpeechDetected, setIsSpeechDetected] = useState(false);
  const [isRecognitionActive, setIsRecognitionActive] = useState(false);
  const [unsupportedMessage, setUnsupportedMessage] = useState("");
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const shouldKeepListeningRef = useRef(false);
  const restartTimeoutRef = useRef<number | null>(null);
  const speechIdleTimeoutRef = useRef<number | null>(null);

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
    onSpeechDetectedChange?.(true);
    clearSpeechIdleTimer();
    speechIdleTimeoutRef.current = window.setTimeout(() => {
      setIsSpeechDetected(false);
      onSpeechDetectedChange?.(false);
      speechIdleTimeoutRef.current = null;
    }, 550);
  };

  const startListening = () => {
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
    const recognition = new Recognition();
    recognition.lang = voiceConfig.locale;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.continuous = true;
    recognition.onstart = () => {
      setIsRecognitionActive(true);
      onListeningChange?.(true);
    };
    recognition.onsoundstart = () => {
      markSpeechDetected();
    };
    recognition.onsoundend = () => {
      clearSpeechIdleTimer();
      speechIdleTimeoutRef.current = window.setTimeout(() => {
        setIsSpeechDetected(false);
        onSpeechDetectedChange?.(false);
        speechIdleTimeoutRef.current = null;
      }, 260);
    };
    recognition.onspeechstart = () => {
      markSpeechDetected();
    };
    recognition.onspeechend = () => {
      // 発話終了直後のブツ切れ感を避けるため、少し余韻を残して停止
      clearSpeechIdleTimer();
      speechIdleTimeoutRef.current = window.setTimeout(() => {
        setIsSpeechDetected(false);
        onSpeechDetectedChange?.(false);
        speechIdleTimeoutRef.current = null;
      }, 220);
    };

    recognition.onresult = (event) => {
      const resultIndex = Math.max(0, (event?.results?.length ?? 1) - 1);
      const transcript = event?.results?.[resultIndex]?.[0]?.transcript?.trim() ?? "";
      if (transcript) {
        markSpeechDetected();
        onTranscript(transcript);
      }
    };
    recognition.onerror = (event) => {
      clearSpeechIdleTimer();
      setIsSpeechDetected(false);
      setIsRecognitionActive(false);
      onListeningChange?.(false);
      onSpeechDetectedChange?.(false);
      if (event?.error === "not-allowed" || event?.error === "service-not-allowed") {
        shouldKeepListeningRef.current = false;
        setUnsupportedMessage("マイク権限が許可されていません。ブラウザ設定をご確認ください。");
      }
    };
    recognition.onend = () => {
      clearSpeechIdleTimer();
      setIsSpeechDetected(false);
      setIsRecognitionActive(false);
      onListeningChange?.(false);
      onSpeechDetectedChange?.(false);
      if (shouldKeepListeningRef.current && !disabled) {
        clearRestartTimer();
        restartTimeoutRef.current = window.setTimeout(() => {
          startListening();
        }, 250);
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
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
    setIsRecognitionActive(false);
    onListeningChange?.(false);
    onSpeechDetectedChange?.(false);
  };

  useEffect(() => {
    if (!voiceConfig.enabled || !voiceConfig.sttEnabled) return;
    shouldKeepListeningRef.current = micEnabled && !disabled;
    if (micEnabled && !disabled) {
      startListening();
    } else {
      stopListening();
    }
    return () => {
      shouldKeepListeningRef.current = false;
      stopListening();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [micEnabled, disabled]);

  useEffect(() => {
    return () => {
      clearSpeechIdleTimer();
    };
  }, []);

  if (!voiceConfig.enabled) return null;

  return (
    <div
      style={{
        position: mode === "overlay" ? "absolute" : "relative",
        left: mode === "overlay" ? 12 : undefined,
        right: mode === "overlay" ? 12 : undefined,
        bottom: mode === "overlay" ? 12 : undefined,
        zIndex: mode === "overlay" ? 20 : undefined,
        padding: mode === "inline" ? "10px 12px" : "8px 10px",
        borderTop: mode === "inline" ? "1px solid #e2e8f0" : undefined,
        borderRadius: mode === "overlay" ? 10 : 0,
        background: mode === "overlay" ? "rgba(255,255,255,0.88)" : "#ffffff",
        backdropFilter: mode === "overlay" ? "blur(4px)" : undefined,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10
      }}
    >
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          minWidth: 28,
          height: 20
        }}
      >
        {[0, 1, 2].map((idx) => {
          const baseHeight = [8, 14, 10][idx];
          const animatedHeight = [14, 20, 16][idx];
          const isActive = isSpeechDetected || isRecognitionActive;
          return (
            <span
              key={idx}
              style={{
                width: 4,
                borderRadius: 999,
                height: isActive ? animatedHeight : baseHeight,
                background: isSpeechDetected ? "#22c55e" : isRecognitionActive ? "#38bdf8" : "#94a3b8",
                transition: "all 120ms ease",
                animation: isActive
                  ? `kagemushaAudioBars ${isSpeechDetected ? 650 : 980}ms ease-in-out ${idx * 90}ms infinite alternate`
                  : "none"
              }}
            />
          );
        })}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginLeft: "auto"
        }}
      >
        <button
          type="button"
          onClick={() => {
            onUserInteraction?.();
            onToggleMic(!micEnabled);
          }}
          disabled={disabled || !voiceConfig.sttEnabled}
          aria-label="音声入力の切り替え"
          style={{
            width: 42,
            height: 42,
            borderRadius: 999,
            border: "1px solid #cbd5e1",
            background: micEnabled ? "#0f172a" : "#fee2e2",
            color: micEnabled ? "#ffffff" : "#dc2626",
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
            width: 42,
            height: 42,
            borderRadius: 999,
            border: "1px solid #cbd5e1",
            background: ttsEnabled ? "#0f172a" : "#fee2e2",
            color: ttsEnabled ? "#ffffff" : "#dc2626",
            display: "grid",
            placeItems: "center",
            cursor: "pointer"
          }}
        >
          <SpeakerIcon muted={!ttsEnabled} />
        </button>
      </div>
      <style>
        {`@keyframes kagemushaAudioBars{from{transform:translateY(0);opacity:.65}to{transform:translateY(-3px);opacity:1}}`}
      </style>
      {unsupportedMessage ? (
        <span
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 50,
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
