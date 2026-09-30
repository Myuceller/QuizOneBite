import { redirect } from "next/navigation";
import { Logo } from "@/components/logo";
import { AuthForm } from "@/features/auth/components/auth-form";
import { getCurrentUser } from "@/server/auth/session";

export const metadata = { title: "회원가입 · 퀴즈퀴즈" };
export default async function SignupPage() {
  if (await getCurrentUser()) redirect("/");
  return <main className="auth-shell"><Logo large /><section className="auth-card">
    <p className="eyebrow">호기심이 쌓이는 곳</p><h1>알아가는 즐거움,<br />함께 시작해요.</h1>
    <p className="intro-description">계정을 만들고 관심 있는 문제를 모아보세요.</p><AuthForm mode="signup" />
  </section></main>;
}
