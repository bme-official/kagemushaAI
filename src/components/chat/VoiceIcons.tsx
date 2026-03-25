type IconProps = {
  muted?: boolean;
};

const baseStyle = {
  width: 18,
  height: 18,
  display: "block"
} as const;

export const MicIcon = ({ muted }: IconProps) => {
  const color = muted ? "#dc2626" : "currentColor";
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" style={baseStyle}>
      <path
        d="M12 2a3 3 0 0 0-3 3v6a3 3 0 1 0 6 0V5a3 3 0 0 0-3-3zM6 11a1 1 0 1 0-2 0 8 8 0 0 0 7 7.94V22H8a1 1 0 1 0 0 2h8a1 1 0 1 0 0-2h-3v-3.06A8 8 0 0 0 20 11a1 1 0 1 0-2 0 6 6 0 1 1-12 0z"
        fill={color}
      />
      {muted ? <path d="M3 3l18 18" stroke={color} strokeWidth="2.4" strokeLinecap="round" /> : null}
    </svg>
  );
};

export const SpeakerIcon = ({ muted }: IconProps) => {
  const color = muted ? "#dc2626" : "currentColor";
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" style={baseStyle}>
      <path
        d="M11.3 4.2a1 1 0 0 0-1.55.83v14a1 1 0 0 0 1.55.83L16.6 16H20a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1h-3.4l-5.3-3.8zM4 9h3.2v6H4a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1z"
        fill={color}
      />
      {muted ? <path d="M3 3l18 18" stroke={color} strokeWidth="2.4" strokeLinecap="round" /> : null}
    </svg>
  );
};
