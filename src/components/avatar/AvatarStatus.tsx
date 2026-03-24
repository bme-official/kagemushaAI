type AvatarStatusProps = {
  status: "idle" | "thinking";
};

export const AvatarStatus = ({ status }: AvatarStatusProps) => {
  return (
    <span style={{ fontSize: 12, color: "#64748b" }}>
      {status === "thinking" ? "入力内容を整理中..." : "ご相談受付中"}
    </span>
  );
};
