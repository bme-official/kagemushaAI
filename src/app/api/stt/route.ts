import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OpenAI API key not configured" }, { status: 500 });
  }

  try {
    const formData = await req.formData();
    const audioBlob = formData.get("audio");
    const language = (formData.get("language") as string | null) ?? "ja";

    if (!audioBlob || !(audioBlob instanceof Blob)) {
      return NextResponse.json({ error: "audio field is required" }, { status: 400 });
    }

    const whisperForm = new FormData();
    whisperForm.append("file", audioBlob, "audio.webm");
    whisperForm.append("model", "whisper-1");
    whisperForm.append("language", language);
    whisperForm.append("response_format", "json");

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: whisperForm
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("[stt] Whisper error:", errText);
      return NextResponse.json({ error: "Whisper API error" }, { status: 502 });
    }

    const data = (await response.json()) as { text?: string };
    const transcript = (data.text ?? "").trim();

    return NextResponse.json({ transcript });
  } catch (err) {
    console.error("[stt] unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const runtime = "nodejs";
