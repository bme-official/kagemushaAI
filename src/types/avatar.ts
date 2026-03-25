export type AvatarGestureState = "idle" | "thinking" | "listening" | "explaining" | "emphasis";

export type AvatarVoiceState = "muted" | "listening" | "speaking";

export type AvatarExpressionState = "neutral" | "smile" | "serious" | "surprised" | "thinking";

export type AvatarBehaviorState = {
  gesture: AvatarGestureState;
  voice: AvatarVoiceState;
  expression: AvatarExpressionState;
  lipSyncActive: boolean;
  statusLabel: string;
};
