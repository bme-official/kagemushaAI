import { NextRequest, NextResponse } from "next/server";

const OPENAI_VOICES = new Set(["alloy", "echo", "fable", "onyx", "nova", "shimmer", "ash", "coral", "sage"]);

/** ElevenLabs TTS (voice が "el:" プレフィックスか ElevenLabs ID 形式の場合) */
async function speakElevenLabs(text: string, voiceId: string): Promise<NextResponse> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    // API キー未設定の場合は OpenAI TTS にフォールバック
    console.warn("[tts] ELEVENLABS_API_KEY未設定 → OpenAI shimmer にフォールバック");
    return speakOpenAI(text, "shimmer");
  }
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
        voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.3, use_speaker_boost: true }
      })
    }
  );
  if (!res.ok) {
    const err = await res.text();
    console.error("[tts/elevenlabs] error:", err, "→ OpenAI shimmer にフォールバック");
    return speakOpenAI(text, "shimmer");
  }
  const buffer = await res.arrayBuffer();
  return new NextResponse(buffer, {
    status: 200,
    headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" }
  });
}

/** OpenAI TTS */
async function speakOpenAI(text: string, voice: string): Promise<NextResponse> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OPENAI_API_KEY not configured" }, { status: 503 });
  }
  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "tts-1", voice, input: text, response_format: "mp3" })
  });
  if (!res.ok) {
    return NextResponse.json({ error: "upstream error" }, { status: 502 });
  }
  const buffer = await res.arrayBuffer();
  return new NextResponse(buffer, {
    status: 200,
    headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" }
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { text?: string; voice?: string };
    const text = String(body.text || "").slice(0, 4096).trim();
    if (!text) return NextResponse.json({ error: "text required" }, { status: 400 });

    const rawVoice = String(body.voice || "nova");

    // "el:VOICE_ID" プレフィックスまたは OpenAI 既知ボイス以外 → ElevenLabs
    if (rawVoice.startsWith("el:")) {
      return speakElevenLabs(text, rawVoice.slice(3));
    }
    if (!OPENAI_VOICES.has(rawVoice)) {
      // OpenAI ボイス名でないものは ElevenLabs ID として扱う
      return speakElevenLabs(text, rawVoice);
    }
    return speakOpenAI(text, rawVoice);
  } catch {
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}
