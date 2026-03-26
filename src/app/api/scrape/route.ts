import { NextRequest, NextResponse } from "next/server";
import { getInMemoryAvatarSettings, setInMemoryAvatarSettings } from "@/lib/avatar/runtimeSettingsStore";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const MAX_TEXT_LENGTH = 8000;

/** HTML から読み取り可能なテキストを抽出する */
function extractText(html: string): string {
  // script / style / noscript タグを除去
  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    // 残りのタグを空白に変換
    .replace(/<[^>]+>/g, " ")
    // HTML エンティティを変換
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    // 連続する空白・改行を1つに圧縮
    .replace(/\s{2,}/g, " ")
    .trim();

  // 長すぎる場合は先頭から MAX_TEXT_LENGTH 文字に切り詰める
  if (text.length > MAX_TEXT_LENGTH) {
    text = text.slice(0, MAX_TEXT_LENGTH) + "…（続きは省略）";
  }
  return text;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { url?: string };
    const url = body.url?.trim();
    if (!url || !/^https?:\/\//.test(url)) {
      return NextResponse.json({ error: "有効な URL を指定してください" }, { status: 400 });
    }

    // 外部サイトをフェッチ
    const fetchRes = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; KagemushaAI-Bot/1.0)"
      },
      signal: AbortSignal.timeout(10000)
    });
    if (!fetchRes.ok) {
      return NextResponse.json(
        { error: `サイトの取得に失敗しました (HTTP ${fetchRes.status})` },
        { status: 502 }
      );
    }
    const html = await fetchRes.text();
    const extractedText = extractText(html);

    // avatar_settings に保存
    const supabase = createSupabaseServerClient();
    if (supabase) {
      const { data: existing } = await supabase
        .from("avatar_settings")
        .select("settings")
        .eq("id", "default")
        .maybeSingle();
      const current = (existing?.settings as Record<string, unknown>) ?? {};
      await supabase.from("avatar_settings").upsert({
        id: "default",
        settings: { ...current, knowledgeBaseUrl: url, knowledgeBaseText: extractedText }
      });
    } else {
      const current = (getInMemoryAvatarSettings() as Record<string, unknown>) ?? {};
      setInMemoryAvatarSettings({ ...current, knowledgeBaseUrl: url, knowledgeBaseText: extractedText });
    }

    return NextResponse.json({ text: extractedText });
  } catch (err) {
    console.error("[scrape] error:", err);
    return NextResponse.json({ error: "スクレイプ中にエラーが発生しました" }, { status: 500 });
  }
}

export const runtime = "nodejs";
