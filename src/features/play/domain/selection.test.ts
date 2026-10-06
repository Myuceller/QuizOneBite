import { describe, expect, it } from 'vitest';
import { qualityScore, selectQuestions, shuffleOptions, type Candidate } from './selection';
const candidate = (id: string, props: Partial<Candidate> = {}): Candidate => ({ id, category: 'science', difficulty: 'medium', ratings: 0, positives: 0, lastSeen: null, ...props });
describe('question selection', () => {
  it('shrinks small samples toward neutral and ranks established positive feedback higher', () => {
    expect(qualityScore(0, 0)).toBe(0.5);
    expect(qualityScore(1, 1)).toBeLessThan(qualityScore(90, 100));
    expect(qualityScore(2, 10)).toBeLessThan(qualityScore(8, 10));
  });
  it('prefers unseen questions over popular old questions, and labels no duplicated selection', () => {
    const bank = [candidate('seen', { ratings: 100, positives: 100, lastSeen: new Date() }), candidate('new')];
    expect(selectQuestions(bank, 1, () => 0)[0].id).toBe('new');
    expect(new Set(selectQuestions(bank, 10).map(q => q.id)).size).toBe(2);
    expect(bank).toHaveLength(2);
  });
  it('only falls back to recent questions after older and unseen ones', () => {
    const now = Date.now();
    const bank = [candidate('recent', { lastSeen: new Date(now) }), candidate('old', { lastSeen: new Date(now - 8 * 86400000) }), candidate('new')];
    expect(selectQuestions(bank, 3, () => 0, now).map(q => q.id)).toEqual(['new', 'old', 'recent']);
  });
  it('uses 60/30/10 pool boundaries and fills unavailable pools', () => {
    const bank = [candidate('popular', { positives: 20, ratings: 20 }), candidate('new'), candidate('other', { positives: 1, ratings: 10 })];
    for (const [roll, id] of [[0.59, 'popular'], [0.6, 'new'], [0.89, 'new'], [0.9, 'other']] as const) {
      expect(selectQuestions(bank, 1, () => roll)[0].id).toBe(id);
    }
    expect(selectQuestions([bank[0]], 5, () => 0.95)).toHaveLength(1);
  });
  it('balances topics and difficulties before applying popularity', () => {
    const bank = [candidate('a'), candidate('b'), candidate('c', { category: 'history' }), candidate('d', { category: 'history', difficulty: 'hard' })];
    const selected = selectQuestions(bank, 2, () => 0);
    expect(selected.map(q => q.category)).toEqual(['science', 'history']);
    expect(selected.map(q => q.difficulty)).toEqual(['medium', 'hard']);
  });
  it('keeps the correct answer associated with shuffled options', () => {
    const result = shuffleOptions(['a','b','c','d'], 2, () => 0);
    expect(result.options).not.toEqual(['a','b','c','d']);
    expect(new Set(result.options).size).toBe(4);
    expect(result.options[result.correctAnswerIndex]).toBe('c');
  });
});
