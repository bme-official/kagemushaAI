import type { VoiceConfig } from "@/types/voice";

export const voiceConfig: VoiceConfig = {
  enabled: true,
  locale: "ja-JP",
  sttEnabled: true,
  ttsEnabled: true,
  autoSpeakAssistant: true,
  speechRate: 1,
  speechPitch: 1,
  transport: "browser_native"
};
