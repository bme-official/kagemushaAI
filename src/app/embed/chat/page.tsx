import { ChatWindow } from "@/components/chat/ChatWindow";

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
    <main style={{ padding: 0, margin: 0, height: "100vh", background: "#fff" }}>
      <ChatWindow sourcePage={sourcePage} />
    </main>
  );
}
