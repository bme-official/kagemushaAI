export type VoiceConfig = {
  enabled: boolean;
  locale: string;
  sttEnabled: boolean;
  ttsEnabled: boolean;
  autoSpeakAssistant: boolean;
  speechRate: number;
  speechPitch: number;
  // TODO: 将来TTL/Realtime音声基盤へ差し替える
  transport: "browser_native" | "ttl_realtime";
};
