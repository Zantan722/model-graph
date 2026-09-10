import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Model Graph — Architecture Studio",
  description: "以對話、拖拉與註解設計軟體架構與 C4 Model。",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant">
      <body className="antialiased">{children}</body>
    </html>
  );
}
