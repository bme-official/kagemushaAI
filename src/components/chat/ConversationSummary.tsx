type ConversationSummaryProps = {
  summary: string;
};

export const ConversationSummary = ({ summary }: ConversationSummaryProps) => {
  return (
    <div
      style={{
        border: "1px solid #cbd5e1",
        borderRadius: 8,
        background: "#f8fafc",
        padding: 10,
        whiteSpace: "pre-wrap",
        fontSize: 13
      }}
    >
      {summary}
    </div>
  );
};
