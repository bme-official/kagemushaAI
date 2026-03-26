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
  onSpeechDetectedChange?: (speaking: boolean) => void;
  /** 発話終了後STT送信中に呼ばれる（listening→thinkingの即時切り替え用） */
  onSpeechProcessingChange?: (processing: boolean) => void;
  onUserInteraction?: () => void;
  mode?: "overlay" | "inline";
  statusLabel?: string;
  /** AECにより不要になったが後方互換のため残す */
  isTtsSpeaking?: boolean;
  /** 無音判定までの時間 (ms, default: 1200) */
  vadSilenceDurationMs?: number;
  /** 発話判定RMS閾値 (default: 0.025) */
  vadThreshold?: number;
  /** 発話確定に必要な連続フレーム数 (default: 4 = 約67ms) */
  vadConfirmFrames?: number;
};

/** MediaRecorder でサポートされている MIME type を選ぶ */
const getSupportedMimeType = (): string => {
  if (typeof MediaRecorder === "undefined") return "";
  const types = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4;codecs=mp4a",
    "audio/mp4",
    "audio/ogg;codecs=opus"
  ];
  return types.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
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
  mode = "overlay",
  statusLabel = "idle",
  vadSilenceDurationMs = 1200,
  vadThreshold = 0.025,
  vadConfirmFrames = 4
}: VoiceControlsProps) => {
  const [unsupportedMessage, setUnsupportedMessage] = useState("");

  // コールバックを ref で保持し、stale closure を防ぐ
  const callbacksRef = useRef({ onTranscript, onListeningChange, onSpeechDetectedChange, onSpeechProcessingChange, onToggleMic });
  useEffect(() => {
    callbacksRef.current = { onTranscript, onListeningChange, onSpeechDetectedChange, onSpeechProcessingChange, onToggleMic };
  });

  const micEnabledRef = useRef(micEnabled);
  const disabledRef = useRef(disabled);
  useEffect(() => { micEnabledRef.current = micEnabled; }, [micEnabled]);
  useEffect(() => { disabledRef.current = disabled; }, [disabled]);

  // --- Audio pipeline refs ---
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const speechActiveRef = useRef(false);
  const silenceTimerRef = useRef<number | null>(null);
  const vadRafRef = useRef<number | null>(null);
  const isSubmittingRef = useRef(false);
  const speechConfirmCountRef = useRef(0); // 連続してthreshold超えたフレーム数（雑音除去）

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current !== null) {
      window.clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  const stopVAD = useCallback(() => {
    if (vadRafRef.current !== null) {
      cancelAnimationFrame(vadRafRef.current);
      vadRafRef.current = null;
    }
  }, []);

  /** 録音チャンクを Whisper に送信してトランスクリプトを取得 */
  const submitAudio = useCallback(async (chunks: Blob[], mimeType: string): Promise<void> => {
    if (chunks.length === 0 || isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    try {
      const blob = new Blob(chunks, { type: mimeType || "audio/webm" });
      if (blob.size < 1000) return; // 1KB 未満は無音と判断してスキップ
      const form = new FormData();
      form.append("audio", blob, `audio.${mimeType.includes("mp4") ? "mp4" : "webm"}`);
      form.append("language", "ja");
      const res = await fetch("/api/stt", { method: "POST", body: form });
      if (!res.ok) return;
      const data = (await res.json()) as { transcript?: string };
      const text = (data.transcript ?? "").trim();
      if (text) {
        callbacksRef.current.onTranscript(text);
      }
    } catch (err) {
      console.warn("[VoiceControls] STT error:", err);
    } finally {
      isSubmittingRef.current = false;
    }
  }, []);

  /** 発話が終わったとき (無音後) に呼ばれる */
  const onSpeechEnd = useCallback(() => {
    speechActiveRef.current = false;
    speechConfirmCountRef.current = 0;
    callbacksRef.current.onSpeechDetectedChange?.(false);
    // STT送信開始を通知 → listening から thinking へ即時切り替え
    callbacksRef.current.onSpeechProcessingChange?.(true);

    const recorder = recorderRef.current;
    if (recorder && recorder.state === "recording") {
      const mimeType = recorder.mimeType;
      recorder.onstop = () => {
        const captured = [...chunksRef.current];
        chunksRef.current = [];
        submitAudio(captured, mimeType).finally(() => {
          callbacksRef.current.onSpeechProcessingChange?.(false);
        });
      };
      recorder.stop();
    } else {
      callbacksRef.current.onSpeechProcessingChange?.(false);
    }
  }, [submitAudio]);

  /** VAD ループ: RAF で約60fps のポーリング */
  const startVADLoop = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;
    const bufferLength = analyser.fftSize;
    const dataArray = new Uint8Array(bufferLength);

    const loop = () => {
      if (!micEnabledRef.current || disabledRef.current) return;
      analyser.getByteTimeDomainData(dataArray);

      // RMS を計算
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        const x = (dataArray[i] - 128) / 128;
        sum += x * x;
      }
      const rms = Math.sqrt(sum / bufferLength);

      const recorder = recorderRef.current;
      if (rms > vadThreshold) {
        // 発話候補: 連続フレーム数をカウント
        speechConfirmCountRef.current++;
        clearSilenceTimer();
        if (!speechActiveRef.current && speechConfirmCountRef.current >= vadConfirmFrames) {
          // N フレーム連続してthresholdを超えた場合のみ発話開始とみなす（雑音を除外）
          speechActiveRef.current = true;
          callbacksRef.current.onSpeechDetectedChange?.(true);
          // 新規録音セッション開始
          chunksRef.current = [];
          if (recorder && recorder.state === "inactive") {
            try { recorder.start(); } catch { /* ignore */ }
          }
        } else if (speechActiveRef.current) {
          // 既に発話中なら何もしない
        }
      } else if (speechActiveRef.current && silenceTimerRef.current === null) {
        // 無音開始 → タイマーセット
        speechConfirmCountRef.current = 0;
        silenceTimerRef.current = window.setTimeout(() => {
          silenceTimerRef.current = null;
          onSpeechEnd();
        }, vadSilenceDurationMs);
      } else if (!speechActiveRef.current) {
        // 発話開始前の無音 → 確認カウントをリセット
        speechConfirmCountRef.current = 0;
      }

      vadRafRef.current = requestAnimationFrame(loop);
    };

    vadRafRef.current = requestAnimationFrame(loop);
  }, [vadThreshold, vadSilenceDurationMs, vadConfirmFrames, clearSilenceTimer, onSpeechEnd]);

  /** マイクストリームを取得して AudioPipeline を構築 */
  const startPipeline = useCallback(async () => {
    setUnsupportedMessage("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,  // TTS のエコーを OS レベルで除去
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      streamRef.current = stream;

      // AudioContext + AnalyserNode for VAD
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.3;
      source.connect(analyser);
      analyserRef.current = analyser;

      // MediaRecorder
      const mimeType = getSupportedMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorderRef.current = recorder;

      callbacksRef.current.onListeningChange?.(true);
      startVADLoop();
    } catch (err: unknown) {
      const error = err as { name?: string };
      console.warn("[VoiceControls] getUserMedia error:", err);
      if (error?.name === "NotAllowedError" || error?.name === "PermissionDeniedError") {
        setUnsupportedMessage("マイク権限が許可されていません。ブラウザ設定をご確認ください。");
      } else {
        setUnsupportedMessage("マイクを開始できませんでした。もう一度お試しください。");
      }
      callbacksRef.current.onToggleMic(false);
    }
  }, [startVADLoop]);

  /** Pipeline を停止してリソースを解放 */
  const stopPipeline = useCallback(() => {
    stopVAD();
    clearSilenceTimer();
    speechActiveRef.current = false;

    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      try { recorderRef.current.stop(); } catch { /* ignore */ }
    }
    recorderRef.current = null;
    chunksRef.current = [];

    if (audioCtxRef.current) {
      try { audioCtxRef.current.close(); } catch { /* ignore */ }
      audioCtxRef.current = null;
    }
    analyserRef.current = null;

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    callbacksRef.current.onListeningChange?.(false);
    callbacksRef.current.onSpeechDetectedChange?.(false);
  }, [stopVAD, clearSilenceTimer]);

  // マイクON/OFF に応じて pipeline を開始・停止
  useEffect(() => {
    if (!voiceConfig.enabled || !voiceConfig.sttEnabled) return;

    if (micEnabled && !disabled) {
      startPipeline();
    } else {
      stopPipeline();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [micEnabled, disabled]);

  // アンマウント時にクリーンアップ
  useEffect(() => {
    return () => { stopPipeline(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isIOS = useMemo(() => {
    if (typeof navigator === "undefined") return false;
    return /iphone|ipad|ipod/i.test(navigator.userAgent);
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
            onUserInteraction?.();
            // iOS は getUserMedia がジェスチャー内で呼ばれることを要求するため
            // onClick で直接 startPipeline を呼ぶ（useEffect 経由は非同期になり失敗する）
            const newEnabled = !micEnabled;
            onToggleMic(newEnabled);
            if (newEnabled && isIOS) {
              startPipeline();
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
