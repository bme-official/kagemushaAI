import { EmbeddedChatClient } from "@/components/chat/EmbeddedChatClient";

type EmbeddedChatPageProps = {
  searchParams?: Promise<{ source?: string | string[]; audio?: string | string[] }>;
};

export default async function EmbeddedChatPage({ searchParams }: EmbeddedChatPageProps) {
  const params = searchParams ? await searchParams : undefined;
  const rawSource = params?.source;
  const source = Array.isArray(rawSource)
    ? rawSource[0] || "/embedded"
    : rawSource || "/embedded";
  const sourcePage = source.length > 200 ? source.slice(0, 200) : source;
  const rawAudio = params?.audio;
  const audio = Array.isArray(rawAudio) ? rawAudio[0] : rawAudio;
  const autoUnlockAudio = audio === "1" || audio === "true";

  return (
    <EmbeddedChatClient sourcePage={sourcePage} autoUnlockAudio={autoUnlockAudio} />
  );
}
