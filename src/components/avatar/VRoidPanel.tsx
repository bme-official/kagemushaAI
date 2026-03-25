import { avatarRuntimeConfig } from "@/config/avatar.runtime.config";
import { VRMCanvas } from "@/components/avatar/VRMCanvas";
import type { AvatarBehaviorState } from "@/types/avatar";

type VRoidPanelProps = {
  behavior: AvatarBehaviorState;
};

export const VRoidPanel = ({ behavior }: VRoidPanelProps) => {
  const isVrmFile = avatarRuntimeConfig.modelUrl.toLowerCase().endsWith(".vrm");

  return (
    <aside
      style={{
        borderRight: "1px solid #e2e8f0",
        background: "#f8fafc",
        display: "flex",
        flexDirection: "column",
        minHeight: 0
      }}
    >
      <div style={{ padding: 10, borderBottom: "1px solid #e2e8f0", fontSize: 13, fontWeight: 600 }}>
        {avatarRuntimeConfig.panelTitle}
      </div>
      <div style={{ flex: 1, display: "grid", placeItems: "center", padding: 12 }}>
        {avatarRuntimeConfig.modelUrl && !isVrmFile ? (
          <iframe
            title="vroid-viewer"
            src={avatarRuntimeConfig.modelUrl}
            style={{ width: "100%", height: "100%", border: "none", borderRadius: 8 }}
          />
        ) : avatarRuntimeConfig.modelUrl && isVrmFile ? (
          <VRMCanvas modelUrl={avatarRuntimeConfig.modelUrl} behavior={behavior} />
        ) : (
          <p style={{ margin: 0, color: "#64748b", fontSize: 13, textAlign: "center" }}>
            {avatarRuntimeConfig.fallbackText}
          </p>
        )}
      </div>
    </aside>
  );
};
