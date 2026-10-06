export type Candidate = {
  id: string; category: string; difficulty: string; positives: number; ratings: number; lastSeen: Date | null;
};
export function qualityScore(positives: number, ratings: number) {
  // Six neutral prior votes prevent a single thumbs-up from outranking established questions.
  return (positives + 3) / (ratings + 6);
}
export function selectQuestions<T extends Candidate>(candidates: T[], count: number, random = Math.random, now = Date.now()): T[] {
  const remaining = [...candidates];
  const selected: T[] = [];
  const categoryCounts = new Map<string, number>();
  const difficultyCounts = new Map<string, number>();
  const hasSignals = candidates.reduce((sum, q) => sum + q.ratings, 0) >= 20;
  const ageTier = (q: T) => !q.lastSeen ? 0 : now - q.lastSeen.getTime() >= 7 * 86400000 ? 1 : 2;
  while (selected.length < count && remaining.length) {
    // Exposure freshness and topic balance take precedence over popularity.
    const tier = Math.min(...remaining.map(ageTier));
    let pool = remaining.filter(q => ageTier(q) === tier);
    const categoryMin = Math.min(...pool.map(q => categoryCounts.get(q.category) ?? 0));
    pool = pool.filter(q => (categoryCounts.get(q.category) ?? 0) === categoryMin);
    const difficultyMin = Math.min(...pool.map(q => difficultyCounts.get(q.difficulty) ?? 0));
    pool = pool.filter(q => (difficultyCounts.get(q.difficulty) ?? 0) === difficultyMin);
    if (hasSignals) {
      const popular = pool.filter(q => q.ratings >= 5 && qualityScore(q.positives, q.ratings) >= 0.6);
      const fresh = pool.filter(q => q.ratings < 5);
      const other = pool.filter(q => !popular.includes(q) && !fresh.includes(q));
      const roll = random();
      const preferred = roll < 0.6 ? popular : roll < 0.9 ? fresh : other;
      if (preferred.length) pool = preferred;
    }
    const picked = pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))];
    selected.push(picked);
    remaining.splice(remaining.indexOf(picked), 1);
    categoryCounts.set(picked.category, (categoryCounts.get(picked.category) ?? 0) + 1);
    difficultyCounts.set(picked.difficulty, (difficultyCounts.get(picked.difficulty) ?? 0) + 1);
  }
  return selected;
}
export function shuffleOptions(options: string[], answerIndex: number, random = Math.random) {
  const indexes = options.map((_, i) => i);
  for (let i = indexes.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [indexes[i], indexes[j]] = [indexes[j], indexes[i]];
  }
  return { options: indexes.map(i => options[i]), correctAnswerIndex: indexes.indexOf(answerIndex) };
}
