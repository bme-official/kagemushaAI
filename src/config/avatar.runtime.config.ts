export const avatarRuntimeConfig = {
  enabled: true,
  provider: "vroid" as const,
  panelTitle: "VRoid Avatar",
  modelUrl: process.env.NEXT_PUBLIC_VRM_MODEL_URL ?? "",
  fallbackText: "VRoidモデルURLを設定すると、ここにアバターを表示します。"
};
