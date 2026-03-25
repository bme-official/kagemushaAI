"use client";

import { useEffect } from "react";

const STORAGE_KEY = "kagemusha-avatar-settings";

const parseSettings = () => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
};

export default function SettingsBridgePage() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const parentOrigin = params.get("parentOrigin") || "*";

    const postSettings = () => {
      const settings = parseSettings();
      window.parent.postMessage(
        {
          type: "kagemusha-avatar-settings",
          settings
        },
        parentOrigin
      );
    };

    const handleMessage = (event: MessageEvent<{ type?: string }>) => {
      if (event.data?.type !== "kagemusha-request-settings") return;
      postSettings();
    };

    postSettings();
    window.addEventListener("message", handleMessage);
    window.addEventListener("storage", postSettings);
    window.addEventListener("kagemusha-avatar-settings-updated", postSettings as EventListener);

    return () => {
      window.removeEventListener("message", handleMessage);
      window.removeEventListener("storage", postSettings);
      window.removeEventListener("kagemusha-avatar-settings-updated", postSettings as EventListener);
    };
  }, []);

  return <main style={{ display: "none" }} />;
}
