import Link from "next/link";

export default function Home() {
  return (
    <main>
      <h1>B&apos;Me Chatbot MVP</h1>
      <p>お問い合わせページにてチャットbotをテストできます。</p>
      <Link href="/contact">/contact へ移動</Link>
    </main>
  );
}
