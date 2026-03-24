"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { ChatWindow } from "@/components/chat/ChatWindow";

export default function EmbeddedChatPage() {
  const searchParams = useSearchParams();
  const source = searchParams.get("source") || "/embedded";
  const sourcePage = useMemo(() => {
    if (!source) return "/embedded";
    return source.length > 200 ? source.slice(0, 200) : source;
  }, [source]);

  return (
    <main style={{ padding: 0, margin: 0, height: "100vh", background: "#fff" }}>
      <ChatWindow sourcePage={sourcePage} />
    </main>
  );
}
