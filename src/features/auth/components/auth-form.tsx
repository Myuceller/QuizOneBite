"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { authClient } from "../client";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const signup = mode === "signup";
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [visible, setVisible] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email")).trim();
    const password = String(data.get("password"));
    const name = String(data.get("name") ?? "").trim();
    if (signup && (name.length < 2 || name.length > 24)) { setError("닉네임은 2~24자로 입력해 주세요."); return; }
    if (signup && password !== data.get("confirm")) { setError("비밀번호가 서로 달라요. 다시 확인해 주세요."); return; }
    setBusy(true);
    setError("");
    try {
      const result = signup
        ? await authClient.signUp.email({ email, password, name })
        : await authClient.signIn.email({ email, password });
      if (result.error) {
        setError(result.error.status === 429 ? "시도가 많아 잠시 쉬어가고 있어요. 1분 후 다시 시도해 주세요."
          : signup ? "가입을 완료하지 못했어요. 입력 내용을 확인하거나 기존 계정으로 로그인해 주세요."
            : "이메일과 비밀번호를 확인해 주세요.");
        setBusy(false);
        return;
      }
      // A full navigation clears any previously cached authenticated server UI.
      window.location.assign(signup ? "/welcome" : "/");
    } catch {
      setError("연결이 원활하지 않아요. 잠시 후 다시 시도해 주세요.");
      setBusy(false);
    }
  }

  return <>
    <form onSubmit={submit} className="auth-form">
      <fieldset disabled={busy} className="auth-fields">
        <legend className="visually-hidden">{signup ? "회원가입 정보" : "로그인 정보"}</legend>
        {signup && <label className="field">닉네임<input name="name" autoComplete="nickname" placeholder="어떻게 불러드릴까요?" minLength={2} maxLength={24} required /></label>}
        <label className="field">이메일<input name="email" type="email" autoComplete="email" placeholder="you@example.com" maxLength={254} required /></label>
        <label className="field">비밀번호
          <span className="password-field"><input name="password" type={visible ? "text" : "password"} autoComplete={signup ? "new-password" : "current-password"} minLength={signup ? 8 : 1} maxLength={128} placeholder={signup ? "8자 이상 입력해 주세요" : "비밀번호를 입력해 주세요"} required />
            <button type="button" onClick={() => setVisible(!visible)} aria-pressed={visible} aria-label={visible ? "비밀번호 숨기기" : "비밀번호 표시"}>{visible ? "숨김" : "표시"}</button></span>
        </label>
        {signup && <label className="field">비밀번호 확인<input name="confirm" type={visible ? "text" : "password"} autoComplete="new-password" maxLength={128} placeholder="비밀번호를 한 번 더 입력해 주세요" required /></label>}
        {error && <p className="error-message" role="alert">{error}</p>}
        <button className="primary-button" type="submit">{busy ? "잠시만 기다려 주세요…" : signup ? "계정 만들기" : "로그인"}</button>
      </fieldset>
    </form>
    <p className="auth-switch">{signup ? "이미 계정이 있나요?" : "아직 계정이 없나요?"} <Link href={signup ? "/login" : "/signup"}>{signup ? "로그인" : "회원가입"}</Link></p>
    {signup && <p className="auth-note">이메일은 로그인에, 닉네임은 화면 표시에 사용해요.<br />만든 문제 모음은 내 계정에 저장돼요.</p>}
  </>;
}
