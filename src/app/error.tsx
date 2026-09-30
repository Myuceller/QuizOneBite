"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main className="auth-shell"><section className="auth-card"><p className="eyebrow">잠시 연결이 끊겼어요</p><h1>다시 만나러 갈까요?</h1><p className="intro-description">화면을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.</p><button className="primary-button retry-button" onClick={reset}>다시 시도</button></section></main>;
}
