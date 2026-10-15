import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { QuestionImageSchema } from './question-image';
const valid = { src: `/quiz-images/${'a'.repeat(32)}.svg`, alt: '세로로 나란한 세 가지 색의 국기', width: 600, height: 400 };
describe('reviewed question images', () => {
  it('accepts only local opaque asset names and bounded accessible dimensions', () => {
    expect(QuestionImageSchema.parse(valid)).toEqual(valid);
    for (const src of ['https://example.com/flag.svg', '//example.com/a.svg', '/quiz-images/italy.svg', '/quiz-images/../secret.svg', valid.src+'?answer=it']) expect(QuestionImageSchema.safeParse({ ...valid, src }).success).toBe(false);
    for (const change of [{ alt: '' }, { width: 0 }, { height: 4001 }, { width: 1.2 }, { answer: 'hidden' }]) expect(QuestionImageSchema.safeParse({ ...valid, ...change }).success).toBe(false);
  });
  it('ships immutable SVGs without answer-bearing metadata, scripts or external requests', () => {
    const files = readdirSync('public/quiz-images').filter(f => f.endsWith('.svg'));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const svg = readFileSync(`public/quiz-images/${file}`, 'utf8');
      expect(file).toBe(createHash('sha256').update(svg).digest('hex').slice(0,32)+'.svg');
      expect(svg).not.toMatch(/<(?:script|image|foreignObject|title|desc|metadata)\b|\bon\w+\s*=/i);
      expect(svg).not.toMatch(/(?:href=["'](?!#)|url\(["']?(?!#))/i);
      expect(svg).toContain('viewBox=');
    }
  });
});
