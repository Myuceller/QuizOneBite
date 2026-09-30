import { redirect } from "next/navigation";
import { Logo } from "@/components/logo";
import { AuthForm } from "@/features/auth/components/auth-form";
import { getCurrentUser } from "@/server/auth/session";

export const metadata = { title: "로그인 · 퀴즈퀴즈" };
export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/");
  return <main className="auth-shell"><Logo large /><section className="auth-card">
    <p className="eyebrow">반가워요, 다시 만났네요</p><h1>오늘도 궁금한 게<br />많은 당신에게.</h1>
    <p className="intro-description">로그인하고 나만의 문제 모음을 이어가세요.</p><AuthForm mode="login" />
  </section></main>;
}
