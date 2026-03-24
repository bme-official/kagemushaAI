import { characterConfig } from "@/config/character.config";

export const AvatarShell = () => {
  return (
    <div
      aria-label="avatar-shell"
      style={{
        width: 36,
        height: 36,
        borderRadius: characterConfig.avatar.shape === "circle" ? "999px" : "8px",
        background: "#e2e8f0",
        color: "#1e293b",
        fontSize: 12,
        display: "grid",
        placeItems: "center",
        fontWeight: 700
      }}
    >
      {characterConfig.avatar.placeholderText}
    </div>
  );
};
