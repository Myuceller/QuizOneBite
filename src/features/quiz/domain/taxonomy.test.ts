import { describe, expect, it } from 'vitest';
import { BankGenerationInputSchema, QUIZ_SUBCATEGORIES, generationTaxonomy } from './taxonomy';

describe('generation taxonomy', () => {
  it('maps every editorial subcategory to a supported play category', () => {
    expect(QUIZ_SUBCATEGORIES).toHaveLength(49);
    expect(new Set(QUIZ_SUBCATEGORIES.map(item => item.id)).size).toBe(49);
    for (const item of QUIZ_SUBCATEGORIES) {
      const input = BankGenerationInputSchema.parse({ category: item.category, subcategory: item.id, difficulty: 'medium', count: 2 });
      expect(generationTaxonomy(input)).toMatchObject({ subcategoryId: item.id, major: item.major, minor: item.minor });
    }
  });
  it('requires a known subcategory belonging to the requested play filter', () => {
    for (const subcategory of [undefined, '', 'unknown', 'culture-film']) {
      expect(BankGenerationInputSchema.safeParse({ category: 'science', subcategory, difficulty: 'hard', count: 1 }).success).toBe(false);
    }
  });
});
