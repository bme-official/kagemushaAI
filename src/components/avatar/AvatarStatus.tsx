type AvatarStatusProps = {
  statusLabel: string;
};

export const AvatarStatus = ({ statusLabel }: AvatarStatusProps) => {
  return (
    <span style={{ fontSize: 12, color: "#64748b" }}>
      {statusLabel}
    </span>
  );
};
