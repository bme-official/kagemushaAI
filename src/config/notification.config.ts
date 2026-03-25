export type NotificationProvider = "console" | "supabase_only" | "resend";

export const notificationConfig = {
  provider: (process.env.NOTIFICATION_PROVIDER as NotificationProvider) ?? "console",
  destinationLabel: process.env.NOTIFICATION_DESTINATION ?? "local-console",
  includeConversationLog: true,
  resendApiKey: process.env.RESEND_API_KEY ?? "",
  notificationToEmail: process.env.NOTIFICATION_TO_EMAIL ?? "",
  notificationFromEmail: process.env.NOTIFICATION_FROM_EMAIL ?? "noreply@kagemusha-ai.vercel.app"
};
