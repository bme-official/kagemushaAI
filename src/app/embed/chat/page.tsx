import { ChatWindow } from "@/components/chat/ChatWindow";
import { VRoidPanel } from "@/components/avatar/VRoidPanel";
import { avatarRuntimeConfig } from "@/config/avatar.runtime.config";

type EmbeddedChatPageProps = {
  searchParams?: Promise<{ source?: string | string[] }>;
};

export default async function EmbeddedChatPage({ searchParams }: EmbeddedChatPageProps) {
  const params = searchParams ? await searchParams : undefined;
  const rawSource = params?.source;
  const source = Array.isArray(rawSource)
    ? rawSource[0] || "/embedded"
    : rawSource || "/embedded";
  const sourcePage = source.length > 200 ? source.slice(0, 200) : source;

  return (
    <main
      style={{
        padding: 0,
        margin: 0,
        height: "100vh",
        background: "#fff",
        display: "grid",
        gridTemplateColumns: avatarRuntimeConfig.enabled ? "240px 1fr" : "1fr"
      }}
    >
      {avatarRuntimeConfig.enabled ? <VRoidPanel /> : null}
      <ChatWindow sourcePage={sourcePage} enableVoice />
    </main>
  );
}
