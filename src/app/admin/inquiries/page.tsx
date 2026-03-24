import { listInquiryRecords } from "@/lib/inquiry/listInquiryRecords";

export default async function AdminInquiriesPage() {
  const items = await listInquiryRecords();

  return (
    <main>
      <h1>問い合わせ管理（MVP）</h1>
      <p>Supabase未接続時はメモリ保存データを表示します。</p>
      <div style={{ display: "grid", gap: 12 }}>
        {items.length ? (
          items.map((item) => (
            <article
              key={item.id}
              style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: 12 }}
            >
              <p style={{ marginTop: 0 }}>
                {new Date(item.createdAt).toLocaleString()} / {item.inquiryIntent ?? "未分類"} /{" "}
                {item.businessCategory ?? "未分類"} / 緊急度: {item.urgency}
              </p>
              <pre style={{ whiteSpace: "pre-wrap", marginBottom: 0 }}>{item.summary}</pre>
            </article>
          ))
        ) : (
          <p>まだ問い合わせはありません。</p>
        )}
      </div>
    </main>
  );
}
