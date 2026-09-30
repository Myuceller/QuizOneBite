import Link from "next/link";

export function Logo({ large = false }: { large?: boolean }) {
  return <Link className={`wordmark${large ? " wordmark-large" : ""}`} href="/" aria-label="퀴즈퀴즈 홈">
    <svg className="logo-mark" viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <rect width="40" height="40" rx="13" fill="currentColor" />
      <path d="M14 15a6 6 0 0 1 12 0c0 4-6 4-6 8" stroke="white" strokeWidth="3" strokeLinecap="round" />
      <circle cx="20" cy="29" r="1.7" fill="white" />
      <path d="m30 28 3 3-3 3" stroke="#B8CBFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
    퀴즈퀴즈
  </Link>;
}
