"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { voiceConfig } from "@/config/voice.config";
import { MicIcon, SpeakerIcon } from "@/components/chat/VoiceIcons";

type VoiceControlsProps = {
  disabled?: boolean;
  onTranscript: (text: string) => void;
  micEnabled: boolean;
  onToggleMic: (enabled: boolean) => void;
  ttsEnabled: boolean;
  onToggleTts: (enabled: boolean) => void;
  onListeningChange?: (listening: boolean) => void;
  onSpeechDetectedChange?: (detected: boolean) => void;
  onSpeechProcessingChange?: (processing: boolean) => void;
  onUserInteraction?: () => void;
  /** TTS再生中フラグ: true の間は SpeechRecognition を停止し VAD のみ動かす */
  isTtsSpeaking?: boolean;
  mode?: "overlay" | "inline";
  statusLabel?: string;
  /** VAD のみ一時停止（ストリームは維持したままマイク入力を無効化する） */
  vadPaused?: boolean;
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
  onSpeechProcessingChange,
  onUserInteraction,
  isTtsSpeaking = false,
  mode = "overlay",
  statusLabel = "idle",
  vadPaused = false
}: VoiceControlsProps) => {
  const [unsupportedMessage, setUnsupportedMessage] = useState("");

  const callbacksRef = useRef({ onTranscript, onListeningChange, onSpeechDetectedChange, onSpeechProcessingChange, onToggleMic });
  useEffect(() => {
    callbacksRef.current = { onTranscript, onListeningChange, onSpeechDetectedChange, onSpeechProcessingChange, onToggleMic };
  });

  const micEnabledRef = useRef(micEnabled);
  const disabledRef = useRef(disabled);
  const isTtsSpeakingRef = useRef(isTtsSpeaking);
  const vadPausedRef = useRef(vadPaused);
  useEffect(() => { micEnabledRef.current = micEnabled; }, [micEnabled]);
  useEffect(() => { disabledRef.current = disabled; }, [disabled]);
  useEffect(() => { isTtsSpeakingRef.current = isTtsSpeaking; }, [isTtsSpeaking]);
  useEffect(() => { vadPausedRef.current = vadPaused; }, [vadPaused]);

  // SpeechRecognition refs
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const recognitionActiveRef = useRef(false);
  const restartTimerRef = useRef<number | null>(null);
  const ttsEndTimerRef = useRef<number | null>(null);
  const speechDetectedRef = useRef(false);

  // RMS VAD refs (TTS中ユーザー音声検知専用)
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const vadRafRef = useRef<number | null>(null);
  const vadCountRef = useRef(0);

  const clearTimers = useCallback(() => {
    if (restartTimerRef.current !== null) { window.clearTimeout(restartTimerRef.current); restartTimerRef.current = null; }
    if (ttsEndTimerRef.current !== null) { window.clearTimeout(ttsEndTimerRef.current); ttsEndTimerRef.current = null; }
  }, []);

  // ==========================
  // SpeechRecognition
  // ==========================
  const stopRecognition = useCallback(() => {
    clearTimers();
    if (recognitionRef.current) {
      recognitionActiveRef.current = false;
      try { recognitionRef.current.abort(); } catch { /* ignore */ }
      recognitionRef.current = null;
    }
  }, [clearTimers]);

  const startRecognition = useCallback(() => {
    if (recognitionActiveRef.current) return;
    if (!micEnabledRef.current || disabledRef.current || vadPausedRef.current || isTtsSpeakingRef.current) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = typeof window !== "undefined" ? (window as unknown as any) : null;
    const Ctor = w ? (w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null) : null;
    if (!Ctor) {
      setUnsupportedMessage("このブラウザは音声入力に対応していません。");
      return;
    }

    const rec = new Ctor();
    rec.lang = "ja-JP";
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onspeechstart = () => {
      if (isTtsSpeakingRef.current) return;
      speechDetectedRef.current = true;
      callbacksRef.current.onSpeechDetectedChange?.(true);
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (event: any) => {
      if (isTtsSpeakingRef.current) return;
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          const text = result[0].transcript.trim();
          if (text) {
            speechDetectedRef.current = false;
            callbacksRef.current.onSpeechDetectedChange?.(false);
            callbacksRef.current.onTranscript(text);
          }
        }
      }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onerror = (event: any) => {
      recognitionActiveRef.current = false;
      speechDetectedRef.current = false;
      callbacksRef.current.onSpeechDetectedChange?.(false);
      if (event.error === "not-allowed" || event.error === "permission-denied") {
        setUnsupportedMessage("マイク権限が許可されていません。ブラウザ設定をご確認ください。");
        callbacksRef.current.onToggleMic(false);
        return;
      }
      if (micEnabledRef.current && !disabledRef.current && !isTtsSpeakingRef.current && !vadPausedRef.current) {
        restartTimerRef.current = window.setTimeout(() => { restartTimerRef.current = null; startRecognition(); }, 300);
      }
    };

    rec.onend = () => {
      recognitionActiveRef.current = false;
      speechDetectedRef.current = false;
      callbacksRef.current.onSpeechDetectedChange?.(false);
      if (micEnabledRef.current && !disabledRef.current && !isTtsSpeakingRef.current && !vadPausedRef.current) {
        restartTimerRef.current = window.setTimeout(() => { restartTimerRef.current = null; startRecognition(); }, 100);
      }
    };

    try {
      rec.start();
      recognitionRef.current = rec;
      recognitionActiveRef.current = true;
      callbacksRef.current.onListeningChange?.(true);
    } catch (err) {
      console.warn("[VoiceControls] recognition.start error:", err);
      recognitionActiveRef.current = false;
    }
  }, [clearTimers]);

  // ==========================
  // RMS VAD（TTS中専用）
  // ==========================
  const stopVAD = useCallback(() => {
    if (vadRafRef.current !== null) { cancelAnimationFrame(vadRafRef.current); vadRafRef.current = null; }
    if (audioCtxRef.current) { try { audioCtxRef.current.close(); } catch { /* ignore */ } audioCtxRef.current = null; }
    analyserRef.current = null;
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
  }, []);

  const startVAD = useCallback(async () => {
    if (streamRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      });
      streamRef.current = stream;
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.25;
      source.connect(analyser);
      analyserRef.current = analyser;

      const data = new Uint8Array(analyser.fftSize);
      const THRESH = 0.03;
      const FRAMES = 5;

      const loop = () => {
        if (!micEnabledRef.current) return;
        vadRafRef.current = requestAnimationFrame(loop);
        if (vadPausedRef.current || !isTtsSpeakingRef.current) { vadCountRef.current = 0; return; }

        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) { const x = (data[i] - 128) / 128; sum += x * x; }
        const rms = Math.sqrt(sum / data.length);

        if (rms > THRESH) {
          vadCountRef.current++;
          if (vadCountRef.current >= FRAMES) {
            vadCountRef.current = 0;
            callbacksRef.current.onSpeechDetectedChange?.(true);
          }
        } else {
          vadCountRef.current = Math.max(0, vadCountRef.current - 1);
        }
      };
      vadRafRef.current = requestAnimationFrame(loop);
    } catch (err) {
      console.warn("[VoiceControls] VAD stream error:", err);
    }
  }, []);

  // ==========================
  // Pipeline 開始・停止
  // ==========================
  const startPipeline = useCallback(async () => {
    setUnsupportedMessage("");
    await startVAD();
    startRecognition();
  }, [startVAD, startRecognition]);

  const stopPipeline = useCallback(() => {
    stopRecognition();
    stopVAD();
    speechDetectedRef.current = false;
    callbacksRef.current.onListeningChange?.(false);
    callbacksRef.current.onSpeechDetectedChange?.(false);
  }, [stopRecognition, stopVAD]);

  // マイク ON/OFF
  useEffect(() => {
    if (!voiceConfig.enabled || !voiceConfig.sttEnabled) return;
    if (micEnabled && !disabled) { startPipeline(); } else { stopPipeline(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [micEnabled, disabled]);

  // TTS 状態変化
  useEffect(() => {
    if (!voiceConfig.enabled || !voiceConfig.sttEnabled) return;
    if (isTtsSpeaking) {
      stopRecognition();
      vadCountRef.current = 0;
    } else {
      if (micEnabledRef.current && !disabledRef.current && !vadPausedRef.current) {
        ttsEndTimerRef.current = window.setTimeout(() => {
          ttsEndTimerRef.current = null;
          callbacksRef.current.onSpeechDetectedChange?.(false);
          startRecognition();
        }, 250);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTtsSpeaking]);

  // vadPaused 変化
  useEffect(() => {
    if (!voiceConfig.enabled || !voiceConfig.sttEnabled) return;
    if (vadPaused) {
      stopRecognition();
      speechDetectedRef.current = false;
      callbacksRef.current.onSpeechDetectedChange?.(false);
    } else {
      if (micEnabledRef.current && !disabledRef.current && !isTtsSpeakingRef.current) {
        startRecognition();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vadPaused]);

  // アンマウント
  useEffect(() => {
    return () => { stopPipeline(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isIOS = useMemo(() => {
    if (typeof navigator === "undefined") return false;
    return /iphone|ipad|ipod/i.test(navigator.userAgent);
  }, []);

  if (!voiceConfig.enabled) return null;

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
      return { width: 4, borderRadius: 999, height: heights[idx], background: barColor, transformOrigin: "bottom center", animation: `kagemushaBarBounce ${duration}ms ease-in-out ${idx * stagger}ms infinite alternate` };
    }
    if (isThinking || isLoading) {
      return { width: 4, borderRadius: 999, height: 7, background: "#94a3b8", transformOrigin: "center", animation: `kagemushaBarThink 1.4s ease-in-out ${idx * 380}ms infinite` };
    }
    return { width: 4, borderRadius: 999, height: [8, 12, 9][idx], background: "#cbd5e1", transition: "all 200ms ease" };
  };

  return (
    <div style={{ position: mode === "overlay" ? "absolute" : "relative", left: mode === "overlay" ? 12 : undefined, right: mode === "overlay" ? 12 : undefined, bottom: mode === "overlay" ? 12 : undefined, zIndex: mode === "overlay" ? 20 : undefined, padding: mode === "inline" ? "10px 12px" : "8px 12px", borderTop: mode === "inline" ? "1px solid #e2e8f0" : undefined, borderRadius: mode === "overlay" ? 12 : 0, background: mode === "overlay" ? "rgba(255,255,255,0.92)" : "#ffffff", backdropFilter: mode === "overlay" ? "blur(6px)" : undefined, display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 8 }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: labelColor, letterSpacing: "0.02em", transition: "color 200ms ease", whiteSpace: "nowrap" }}>{statusLabel}</span>
      <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5, height: 20 }}>
        {[0, 1, 2].map((idx) => (<span key={idx} style={getBarStyle(idx)} />))}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end" }}>
        <button type="button" onClick={() => { onUserInteraction?.(); const n = !micEnabled; onToggleMic(n); if (n && isIOS) { startPipeline(); } }} disabled={disabled || !voiceConfig.sttEnabled} aria-label="音声入力の切り替え" style={{ width: 40, height: 40, borderRadius: 999, border: "none", background: "none", color: micEnabled ? "#0f172a" : "#dc2626", display: "grid", placeItems: "center", cursor: "pointer" }}>
          <MicIcon muted={!micEnabled} />
        </button>
        <button type="button" onClick={() => { onUserInteraction?.(); onToggleTts(!ttsEnabled); }} disabled={disabled || !voiceConfig.ttsEnabled} aria-label="読み上げの切り替え" style={{ width: 40, height: 40, borderRadius: 999, border: "none", background: "none", color: ttsEnabled ? "#0f172a" : "#dc2626", display: "grid", placeItems: "center", cursor: "pointer" }}>
          <SpeakerIcon muted={!ttsEnabled} />
        </button>
      </div>
      <style>{`
        @keyframes kagemushaBarBounce { from { transform: scaleY(1); opacity: 0.7; } to { transform: scaleY(1.9); transform-origin: center; opacity: 1; } }
        @keyframes kagemushaBarThink { 0%, 100% { opacity: 0.3; background: #e2e8f0; transform: scaleY(0.7); } 50% { opacity: 1; background: #64748b; transform: scaleY(1.25); } }
      `}</style>
      {unsupportedMessage ? (<span style={{ position: "absolute", left: 0, right: 0, bottom: 54, fontSize: 12, color: "#b45309", textAlign: "center" }}>{unsupportedMessage}</span>) : null}
    </div>
  );
};
