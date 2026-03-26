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
      poses: Array<"neutral" | "upright" | "friendly" | "leanForward" | "confident">;
      gestureOptionIds: string[];
    }
  >;
  services?: Array<{
    name: string;
    ruby: string;
    description: string;
  }>;
  /** スクレイプ元 URL */
  knowledgeBaseUrl?: string;
  /** ウェブサイトから取得した会社・サービス情報テキスト */
  knowledgeBaseText?: string;
  /** TTS 読み方補正リスト */
  ttsCorrections?: Array<{ term: string; reading: string }>;
};

let inMemorySettings: RuntimeAvatarSettings | null = null;

export const getInMemoryAvatarSettings = () => inMemorySettings;

export const setInMemoryAvatarSettings = (settings: RuntimeAvatarSettings) => {
  inMemorySettings = settings;
};
