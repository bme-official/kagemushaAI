import { NextRequest, NextResponse } from "next/server";
import { uiConfig } from "@/config/ui.config";

const buildWidgetScript = (baseAppUrl: string) => {
  const escapedBase = baseAppUrl.replace(/"/g, "");
  const escapedLabel = uiConfig.widgetButtonLabel.replace(/"/g, "");
  const escapedTitle = uiConfig.widgetModalTitle.replace(/"/g, "");
  const escapedPath = uiConfig.widgetIframePath.replace(/"/g, "");

  return `
(() => {
  if (window.__KAGEMUSHA_CHAT_WIDGET_LOADED__) return;
  if (window.__BME_CHAT_WIDGET_LOADED__) return;
  window.__KAGEMUSHA_CHAT_WIDGET_LOADED__ = true;
  window.__BME_CHAT_WIDGET_LOADED__ = true;

  const scriptEl =
    document.currentScript ||
    document.querySelector(
      'script[data-bme-chat-widget="1"]:last-of-type, script[data-kagemusha-ai-chat-widget="1"]:last-of-type'
    );
  const appUrl = (scriptEl?.dataset?.appUrl || "${escapedBase}").replace(/\\/$/, "");
  const buttonLabel = scriptEl?.dataset?.buttonLabel || "${escapedLabel}";
  const modalTitle = scriptEl?.dataset?.modalTitle || "${escapedTitle}";
  const iframePath = scriptEl?.dataset?.iframePath || "${escapedPath}";

  const style = document.createElement("style");
  style.textContent = \`
    .kagemusha-chat-btn { position: fixed; right: 20px; bottom: 20px; z-index: 999998; background:#0f172a; color:#fff; border:none; border-radius:999px; padding:12px 16px; cursor:pointer; font-size:14px; box-shadow:0 8px 24px rgba(15,23,42,.3); }
    .kagemusha-chat-backdrop { position:fixed; inset:0; z-index:999999; display:none; background:rgba(2,6,23,.45); }
    .kagemusha-chat-backdrop.open { display:block; }
    .kagemusha-chat-modal { position:absolute; right:20px; bottom:80px; width:min(420px,calc(100vw - 24px)); height:min(700px,calc(100vh - 110px)); background:#fff; border-radius:12px; overflow:hidden; box-shadow:0 16px 40px rgba(2,6,23,.35); display:flex; flex-direction:column; }
    .kagemusha-chat-header { display:flex; align-items:center; justify-content:space-between; gap:8px; padding:10px 12px; border-bottom:1px solid #e2e8f0; font-size:14px; font-weight:600; }
    .kagemusha-chat-close { border:none; background:transparent; cursor:pointer; font-size:20px; line-height:1; color:#475569; }
    .kagemusha-chat-iframe { width:100%; flex:1 1 auto; min-height:0; border:none; display:block; }
    @media (max-width: 640px) {
      .kagemusha-chat-modal { inset: 0; width:100vw; height:100vh; border-radius:0; right:0; bottom:0; }
      .kagemusha-chat-btn { right: 12px; bottom: 12px; }
    }
  \`;
  document.head.appendChild(style);

  const button = document.createElement("button");
  button.className = "kagemusha-chat-btn";
  button.type = "button";
  button.textContent = buttonLabel;

  const backdrop = document.createElement("div");
  backdrop.className = "kagemusha-chat-backdrop";
  backdrop.setAttribute("aria-hidden", "true");

  const modal = document.createElement("div");
  modal.className = "kagemusha-chat-modal";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");

  const header = document.createElement("div");
  header.className = "kagemusha-chat-header";
  const title = document.createElement("span");
  title.textContent = modalTitle;
  const closeBtn = document.createElement("button");
  closeBtn.className = "kagemusha-chat-close";
  closeBtn.type = "button";
  closeBtn.setAttribute("aria-label", "close");
  closeBtn.textContent = "×";
  header.appendChild(title);
  header.appendChild(closeBtn);

  const iframe = document.createElement("iframe");
  iframe.className = "kagemusha-chat-iframe";
  iframe.allow = "microphone *";
  iframe.referrerPolicy = "strict-origin-when-cross-origin";

  const open = () => {
    if (!iframe.src) {
      const source = encodeURIComponent(window.location.href);
      iframe.src = appUrl + iframePath + "?source=" + source + "&audio=1";
    }
    backdrop.classList.add("open");
    backdrop.setAttribute("aria-hidden", "false");
  };

  const close = () => {
    backdrop.classList.remove("open");
    backdrop.setAttribute("aria-hidden", "true");
  };

  button.addEventListener("click", open);
  closeBtn.addEventListener("click", close);
  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) close();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") close();
  });

  modal.appendChild(header);
  modal.appendChild(iframe);
  backdrop.appendChild(modal);

  const mount = () => {
    document.body.appendChild(button);
    document.body.appendChild(backdrop);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount, { once: true });
  } else {
    mount();
  }
})();
`.trim();
};

export async function GET(request: NextRequest) {
  const fallbackUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
  const script = buildWidgetScript(fallbackUrl);
  return new NextResponse(script, {
    status: 200,
    headers: {
      "content-type": "application/javascript; charset=utf-8",
      "cache-control": "public, max-age=300"
    }
  });
}
