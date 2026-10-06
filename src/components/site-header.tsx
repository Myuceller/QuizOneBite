import Link from "next/link";
import { Logo } from "./logo";
import { getCurrentUser } from "@/server/auth/session";
import { LogoutButton } from "@/features/auth/components/logout-button";

export async function SiteHeader() {
  const user = await getCurrentUser();
  return <header className="site-header">
    <Logo />
    <nav className="header-nav" aria-label="주 메뉴">
      {user ? <><Link href="/">퀴즈 풀기</Link><Link href="/play/history">풀이 기록</Link><LogoutButton /></> : <><Link href="/login">로그인</Link><Link className="nav-signup" href="/signup">시작하기</Link></>}
    </nav>
  </header>;
}
