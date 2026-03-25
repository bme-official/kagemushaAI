import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getInMemoryAvatarSettings,
  setInMemoryAvatarSettings
} from "@/lib/avatar/runtimeSettingsStore";

const SETTINGS_ID = "default";

type RuntimeAvatarSettings = {
  modelUrl?: string;
  avatarName?: string;
  avatarNameKana?: string;
  avatarAge?: string;
  companyName?: string;
  companyNameKana?: string;
  voiceModel?: string;
  ttsApiVoice?: string;
  profile?: string;
  statuses?: string[];
  statusMappings?: Record<
    string,
    {
      expressionOptionIds: string[];
      poses: Array<"neutral" | "upright" | "friendly" | "leanForward" | "confident">;
      gestureOptionIds: string[];
    }
  >;
  services?: Array<{
    name: string;
    ruby: string;
    description: string;
  }>;
  widgetButtonLabel?: string;
  widgetModalTitle?: string;
};

const withCors = (response: NextResponse) => {
  response.headers.set("access-control-allow-origin", "*");
  response.headers.set("access-control-allow-methods", "GET, POST, OPTIONS");
  response.headers.set("access-control-allow-headers", "content-type");
  response.headers.set("cache-control", "no-store");
  return response;
};

export async function OPTIONS() {
  return withCors(new NextResponse(null, { status: 204 }));
}

export async function GET() {
  const supabase = createSupabaseServerClient();
  if (supabase) {
    const { data } = await supabase
      .from("avatar_settings")
      .select("settings")
      .eq("id", SETTINGS_ID)
      .maybeSingle();
    const settings = (data?.settings as RuntimeAvatarSettings | undefined) ?? getInMemoryAvatarSettings();
    return withCors(NextResponse.json({ settings: settings ?? null }));
  }

  return withCors(NextResponse.json({ settings: getInMemoryAvatarSettings() ?? null }));
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { settings?: RuntimeAvatarSettings };
  const settings = body.settings;
  if (!settings || typeof settings !== "object") {
    return withCors(
      NextResponse.json({ message: "settings is required." }, { status: 400 })
    );
  }

  setInMemoryAvatarSettings(settings);

  const supabase = createSupabaseServerClient();
  if (supabase) {
    await supabase.from("avatar_settings").upsert(
      {
        id: SETTINGS_ID,
        settings,
        updated_at: new Date().toISOString()
      },
      { onConflict: "id" }
    );
  }

  return withCors(NextResponse.json({ ok: true }));
}
