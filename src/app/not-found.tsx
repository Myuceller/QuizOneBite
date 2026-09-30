import Link from "next/link";
import { Logo } from "@/components/logo";
export default function NotFound() {
  return <main className="auth-shell"><Logo /><section className="auth-card"><p className="eyebrow">404</p><h1>페이지를 찾지 못했어요.</h1><p className="intro-description">주소를 확인하거나 홈에서 다시 시작해 주세요.</p><Link className="primary-button button-link retry-button" href="/">홈으로</Link></section></main>;
}
