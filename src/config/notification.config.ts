export type NotificationProvider = "console" | "supabase_only";

export const notificationConfig = {
  provider: (process.env.NOTIFICATION_PROVIDER as NotificationProvider) ?? "console",
  destinationLabel: process.env.NOTIFICATION_DESTINATION ?? "local-console",
  includeConversationLog: true
};
