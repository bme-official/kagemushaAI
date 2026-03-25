"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { voiceConfig } from "@/config/voice.config";

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
  onUserInteraction
}: VoiceControlsProps) => {
  const [isSpeechDetected, setIsSpeechDetected] = useState(false);
  const [unsupportedMessage, setUnsupportedMessage] = useState("");
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const shouldKeepListeningRef = useRef(false);
  const restartTimeoutRef = useRef<number | null>(null);

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
      onListeningChange?.(true);
    };
    recognition.onspeechstart = () => {
      setIsSpeechDetected(true);
      onSpeechDetectedChange?.(true);
    };
    recognition.onspeechend = () => {
      setIsSpeechDetected(false);
      onSpeechDetectedChange?.(false);
    };

    recognition.onresult = (event) => {
      const resultIndex = Math.max(0, (event?.results?.length ?? 1) - 1);
      const transcript = event?.results?.[resultIndex]?.[0]?.transcript?.trim() ?? "";
      if (transcript) {
        onTranscript(transcript);
      }
    };
    recognition.onerror = (event) => {
      setIsSpeechDetected(false);
      onListeningChange?.(false);
      onSpeechDetectedChange?.(false);
      if (event?.error === "not-allowed" || event?.error === "service-not-allowed") {
        shouldKeepListeningRef.current = false;
        setUnsupportedMessage("マイク権限が許可されていません。ブラウザ設定をご確認ください。");
      }
    };
    recognition.onend = () => {
      setIsSpeechDetected(false);
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

  if (!voiceConfig.enabled) return null;

  return (
    <div
      style={{
        position: "absolute",
        left: 12,
        right: 12,
        bottom: 12,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10
      }}
    >
      <div
        style={{
          display: "inline-flex",
          alignItems: "flex-end",
          gap: 4,
          minWidth: 28,
          height: 20
        }}
      >
        {[0, 1, 2].map((idx) => {
          const baseHeight = [8, 14, 10][idx];
          const animatedHeight = [14, 20, 16][idx];
          return (
            <span
              key={idx}
              style={{
                width: 4,
                borderRadius: 999,
                height: isSpeechDetected ? animatedHeight : baseHeight,
                background: isSpeechDetected ? "#22c55e" : "#94a3b8",
                transition: "all 120ms ease"
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
            background: micEnabled ? "#0f172a" : "#ffffff",
            color: micEnabled ? "#ffffff" : "#0f172a",
            display: "grid",
            placeItems: "center",
            cursor: "pointer"
          }}
        >
          <span style={{ fontSize: 18, lineHeight: 1 }}>🎤</span>
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
            background: ttsEnabled ? "#0f172a" : "#ffffff",
            color: ttsEnabled ? "#ffffff" : "#0f172a",
            display: "grid",
            placeItems: "center",
            cursor: "pointer"
          }}
        >
          <span style={{ fontSize: 18, lineHeight: 1 }}>🔊</span>
        </button>
      </div>
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
