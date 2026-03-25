type RuntimeAvatarSettings = {
  modelUrl?: string;
  avatarName?: string;
  avatarNameKana?: string;
  avatarAge?: string;
  companyName?: string;
  companyNameKana?: string;
  voiceModel?: string;
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
};

let inMemorySettings: RuntimeAvatarSettings | null = null;

export const getInMemoryAvatarSettings = () => inMemorySettings;

export const setInMemoryAvatarSettings = (settings: RuntimeAvatarSettings) => {
  inMemorySettings = settings;
};
