import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "퀴즈퀴즈 · 상식 퀴즈",
  description: "아는 것도, 새로운 것도. 과학·역사·지리·문화 상식 퀴즈로 알아가는 즐거움을 만나보세요.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
