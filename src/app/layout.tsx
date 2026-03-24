import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "B'Me Contact MVP",
  description: "Config-driven contact chatbot MVP"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
