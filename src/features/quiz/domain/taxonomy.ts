import { z } from 'zod';
import { QuizGenerationInputSchema, type QuizGenerationInput } from './quiz.ts';

// Editorial categories map to the five existing play filters until the UI/DB migration.
const groups = [
  ['science', 'science', '과학·자연', [['space','우주·천문'],['physics','물리'],['chemistry','화학'],['nature','동물·식물'],['biology','인체·생명'],['earth','지구·기후']]],
  ['technology', 'general', '기술·공학', [['computing','컴퓨터·인터넷'],['ai','AI·데이터'],['electronics','전자·통신'],['machines','기계·로봇'],['energy','에너지'],['inventions','발명·기술사']]],
  ['history', 'history', '역사', [['korea','한국사'],['east-asia','동아시아사'],['europe','유럽사'],['africa-middle-east','중동·아프리카사'],['americas','아메리카사']]],
  ['geography', 'geography', '지리·세계', [['countries','국가·수도'],['places','도시·명소'],['land-ocean','지형·바다'],['borders','국기·국경'],['customs','세계의 생활·풍습']]],
  ['society', 'general', '사회·경제', [['economics','경제 원리'],['finance','돈·금융'],['industry','기업·산업'],['politics','정치·제도'],['rights','법·권리'],['organizations','국제기구']]],
  ['culture', 'culture', '문화·예술', [['film','영화·드라마'],['music','음악'],['art','미술·디자인'],['architecture','건축'],['performance','공연·전통예술']]],
  ['humanities', 'general', '언어·인문', [['korean','한국어·어원'],['languages','외국어·문자'],['literature','문학·작가'],['philosophy','철학·사상'],['mythology','신화·종교']]],
  ['lifestyle', 'general', '생활·음식', [['food','음식·식재료'],['cooking','요리·조리 원리'],['household','생활용품'],['fashion','의복·패션'],['home','주거·생활문화']]],
  ['sports', 'general', '스포츠·게임', [['ball','구기 종목'],['athletics','육상·수영'],['combat','격투·체조'],['winter-racket','동계·라켓 스포츠'],['board','보드게임'],['video','비디오게임']]],
] as const;

export const QUIZ_SUBCATEGORIES = groups.flatMap(([major, category, majorLabel, children]) =>
  children.map(([slug, minor]) => ({ id: `${major}-${slug}`, major, majorLabel, minor, category })),
);

export function getSubcategory(id: string) {
  const item = QUIZ_SUBCATEGORIES.find(item => item.id === id);
  if (!item) throw new Error('UNKNOWN_SUBCATEGORY');
  return item;
}

export const BankGenerationInputSchema = QuizGenerationInputSchema.extend({
  subcategory: z.string().refine(id => QUIZ_SUBCATEGORIES.some(item => item.id === id), 'Unknown subcategory'),
}).strict().refine(input => QUIZ_SUBCATEGORIES.some(item => item.id === input.subcategory && item.category === input.category), {
  message: 'Subcategory does not belong to the selected play category', path: ['subcategory'],
});
export type BankGenerationInput = QuizGenerationInput & { subcategory: string };

export function generationTaxonomy(input: BankGenerationInput) {
  const item = getSubcategory(BankGenerationInputSchema.parse(input).subcategory);
  return { version: 'v1', subcategoryId: item.id, major: item.major, minor: item.minor, tags: [] as string[] };
}
