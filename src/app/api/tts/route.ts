import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "not configured" }, { status: 503 });
  }
  try {
    const body = (await request.json()) as { text?: string; voice?: string };
    const text = String(body.text || "")
      .slice(0, 4096)
      .trim();
    if (!text) {
      return NextResponse.json({ error: "text required" }, { status: 400 });
    }
    const voice = String(body.voice || "nova");
    const res = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "tts-1",
        voice,
        input: text,
        response_format: "mp3"
      })
    });
    if (!res.ok) {
      return NextResponse.json({ error: "upstream error" }, { status: 502 });
    }
    const buffer = await res.arrayBuffer();
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store"
      }
    });
  } catch {
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}
