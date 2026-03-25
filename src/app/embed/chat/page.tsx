import { EmbeddedChatClient } from "@/components/chat/EmbeddedChatClient";

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
    <EmbeddedChatClient sourcePage={sourcePage} />
  );
}
