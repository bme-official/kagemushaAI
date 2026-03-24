import type { InquiryRecord } from "@/types/inquiry";

type InquiryDetailProps = {
  inquiry: InquiryRecord | null;
};

export const InquiryDetail = ({ inquiry }: InquiryDetailProps) => {
  if (!inquiry) return <p>詳細を選択してください。</p>;

  return (
    <article style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: 12 }}>
      <h3 style={{ marginTop: 0 }}>問い合わせ詳細</h3>
      <pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>{inquiry.summary}</pre>
    </article>
  );
};
