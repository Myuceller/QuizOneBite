import type { CSSProperties } from 'react';

/** Decorative and deterministic: rendered only after a server-confirmed result. */
export function Celebration() {
  return <span className="celebration" aria-hidden="true">
    {Array.from({ length: 18 }, (_, i) => <i key={i} style={{
      '--confetti-x': `${5 + (i * 37) % 90}%`,
      '--confetti-drift': `${(i % 5 - 2) * 22}px`,
      '--confetti-turn': `${i % 2 ? 230 : -200}deg`,
      '--confetti-delay': `${(i % 6) * 35}ms`,
    } as CSSProperties} />)}
  </span>;
}
