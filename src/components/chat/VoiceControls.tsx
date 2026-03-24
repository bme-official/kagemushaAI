"use client";

import { useMemo, useRef, useState } from "react";
import { voiceConfig } from "@/config/voice.config";

type SpeechRecognitionAlternativeLike = {
  transcript: string;
};

type SpeechRecognitionResultLike = {
  [index: number]: SpeechRecognitionAlternativeLike;
};

type SpeechRecognitionEventLike = Event & {
  results: {
    [index: number]: SpeechRecognitionResultLike;
  };
};

type BrowserSpeechRecognition = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
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
  ttsEnabled: boolean;
  onToggleTts: (enabled: boolean) => void;
};

export const VoiceControls = ({
  disabled,
  onTranscript,
  ttsEnabled,
  onToggleTts
}: VoiceControlsProps) => {
  const [isListening, setIsListening] = useState(false);
  const [unsupportedMessage, setUnsupportedMessage] = useState("");
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);

  const hasSpeechRecognition = useMemo(() => {
    if (typeof window === "undefined") return false;
    const speechWindow = window as SpeechWindow;
    return Boolean(speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition);
  }, []);

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

    recognition.onresult = (event) => {
      const transcript = event?.results?.[0]?.[0]?.transcript?.trim() ?? "";
      if (transcript) {
        onTranscript(transcript);
      }
    };
    recognition.onerror = () => {
      setIsListening(false);
    };
    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    setIsListening(true);
    recognition.start();
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
  };

  if (!voiceConfig.enabled) return null;

  return (
    <div
      style={{
        borderTop: "1px solid #e2e8f0",
        padding: "8px 12px",
        display: "flex",
        flexWrap: "wrap",
        gap: 8,
        alignItems: "center"
      }}
    >
      <button
        type="button"
        onClick={isListening ? stopListening : startListening}
        disabled={disabled || !voiceConfig.sttEnabled}
      >
        {isListening ? "音声入力停止" : "音声入力開始"}
      </button>
      <button
        type="button"
        onClick={() => onToggleTts(!ttsEnabled)}
        disabled={disabled || !voiceConfig.ttsEnabled}
      >
        {ttsEnabled ? "読み上げON" : "読み上げOFF"}
      </button>
      {unsupportedMessage ? (
        <span style={{ fontSize: 12, color: "#b45309" }}>{unsupportedMessage}</span>
      ) : null}
      {/* TODO: TTLリアルタイム接続状態インジケータを追加 */}
    </div>
  );
};
