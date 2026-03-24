import type { InquiryRecord } from "@/types/inquiry";

type InquiryListProps = {
  inquiries: InquiryRecord[];
  onSelect: (inquiry: InquiryRecord) => void;
};

export const InquiryList = ({ inquiries, onSelect }: InquiryListProps) => {
  if (!inquiries.length) return <p>まだ問い合わせはありません。</p>;

  return (
    <ul style={{ display: "grid", gap: 8, padding: 0, listStyle: "none" }}>
      {inquiries.map((inquiry) => (
        <li key={inquiry.id} style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: 8 }}>
          <button type="button" onClick={() => onSelect(inquiry)}>
            {new Date(inquiry.createdAt).toLocaleString()} - {inquiry.inquiryIntent ?? "未分類"}
          </button>
        </li>
      ))}
    </ul>
  );
};
