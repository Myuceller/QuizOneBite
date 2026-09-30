"use client";
import { useState } from "react";
import { authClient } from "../client";

export function LogoutButton() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  return <span className="logout-control">
    <button className="text-button" disabled={busy} onClick={async () => {
      setBusy(true); setError(false);
      try {
        const result = await authClient.signOut();
        if (result.error) throw new Error("Sign out failed");
        // Clear authenticated server UI and browser router caches after revocation.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.assign("/login");
      } catch { setError(true); setBusy(false); }
    }}>{busy ? "로그아웃 중…" : "로그아웃"}</button>
    {error && <span role="alert" className="logout-error">다시 시도해 주세요.</span>}
  </span>;
}
