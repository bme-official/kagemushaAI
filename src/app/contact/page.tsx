"use client";

export default function ContactPage() {
  return (
    <main>
      <h1>お問い合わせ</h1>
      <p>このページは既存フォーム運用専用です。アバターテストはトップページをご利用ください。</p>

      <section style={{ border: "1px solid #cbd5e1", borderRadius: 10, padding: 16 }}>
        <h2 style={{ marginTop: 0 }}>既存フォーム（温存領域）</h2>
        {/* TODO: 実サイト既存フォームをここに差し込む。今回MVPでは壊さないためプレースホルダー表示のみ */}
        <form style={{ display: "grid", gap: 8 }}>
          <input placeholder="組織・団体名（任意）" />
          <input placeholder="担当者名（必須）" />
          <input placeholder="メールアドレス（必須）" />
          <input placeholder="電話番号（任意）" />
          <textarea placeholder="お問い合わせ内容（必須）" rows={4} />
          <button type="button">フォーム送信（既存想定）</button>
        </form>
      </section>

    </main>
  );
}
