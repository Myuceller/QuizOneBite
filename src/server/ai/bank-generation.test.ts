import { beforeEach, describe, expect, it, vi } from 'vitest';
const { create, clientOptions } = vi.hoisted(() => ({ create: vi.fn(), clientOptions: vi.fn() }));
vi.mock('openai', () => ({ default: class {
  responses = { create };
  constructor(options: unknown) { clientOptions(options); }
} }));
import { OpenAIBankGenerator, buildBankRequest, monthlyBudgetMicros, usageCharge } from './bank-generation';
const input = { category: 'science', difficulty: 'medium', count: 1 } as const;
const evidence = [{ id: 'water', title: '검증 자료', url: 'https://example.com/water', facts: '물의 화학식은 H₂O다.' }];
const question = { question: '물의 화학식은?', options: ['H₂O','CO₂','O₂','NaCl'], correctAnswerIndex: 0, explanation: '물은 H₂O다.', evidenceIds: ['water'] };
function response(questions = [question]) { return { id: 'resp_test', status: 'completed', service_tier: 'default', output: [], output_text: JSON.stringify({ questions }), usage: { input_tokens: 100, output_tokens: 200 } }; }
beforeEach(() => { vi.clearAllMocks(); create.mockResolvedValue(response()); });
describe('operator bank generation', () => {
  it('makes one bounded request and attaches only operator supplied sources', async () => {
    const result = await new OpenAIBankGenerator('test-key',evidence).generate(input);
    expect(create).toHaveBeenCalledOnce();
    expect(clientOptions).toHaveBeenCalledWith({ apiKey: 'test-key', baseURL: 'https://api.openai.com/v1', timeout: 60000, maxRetries: 0 });
    expect(create.mock.calls[0][0]).toMatchObject({ model: 'gpt-6-astra', max_output_tokens: 4000, service_tier: 'default', store: false, reasoning: { effort: 'low' } });
    expect(result.sources).toEqual([[{ title: evidence[0].title, url: evidence[0].url }]]);
    expect(result.metadata.verificationStatus).toBe('unreviewed');
    expect(result.usage).toEqual({ inputTokens: 100, outputTokens: 200, responseId: 'resp_test' });
  });
  it.each(['incomplete','failed','cancelled'])('retains usage when %s output is rejected', async status => {
    create.mockResolvedValue({ ...response(), status });
    await expect(new OpenAIBankGenerator('test-key',evidence).generate(input)).rejects.toMatchObject({ code: 'INVALID_OUTPUT', usage: { inputTokens: 100, outputTokens: 200 } });
  });
  it.each([
    { ...question, evidenceIds: ['invented'] }, { ...question, evidenceIds: [] },
    { ...question, options: ['A',' A ','B','C'] }, { ...question, correctAnswerIndex: 4 },
  ])('rejects invented sources and invalid options/answers', async value => {
    create.mockResolvedValue(response([value]));
    await expect(new OpenAIBankGenerator('test-key',evidence).generate(input)).rejects.toMatchObject({ code: 'INVALID_OUTPUT' });
  });
  it('rejects repeated questions, refusal, malformed JSON and missing usage', async () => {
    for (const value of [response([question,question]), { ...response(), output: [{ type: 'message', content: [{type:'refusal'}] }] }, { ...response(), output_text: '{' }, { ...response(), usage: null }]) {
      create.mockResolvedValue(value);
      await expect(new OpenAIBankGenerator('test-key',evidence).generate(input)).rejects.toMatchObject({ code: 'INVALID_OUTPUT' });
    }
  });
  it('fails before calling AI for unsupported pricing, count and oversized input', async () => {
    expect(() => buildBankRequest(input,evidence,[],'other-model')).toThrow('UNPRICED_MODEL');
    expect(() => buildBankRequest({ ...input,count: 6 },evidence)).toThrow();
    expect(() => buildBankRequest(input,evidence,['가'.repeat(6000)])).toThrow('INPUT_TOO_LARGE');
    expect(create).not.toHaveBeenCalled();
  });
  it('sanitizes transport errors and holds a reservation if billing is uncertain', async () => {
    create.mockRejectedValue(new Error('test-key private request'));
    await expect(new OpenAIBankGenerator('test-key',evidence).generate(input)).rejects.toMatchObject({ code: 'AI_UNAVAILABLE', usage: undefined });
    expect(usageCharge()).toBe(500000);
    expect(usageCharge({inputTokens:100,outputTokens:200,responseId:null})).toBe(11250);
  });
  it('starts disabled and only accepts bounded explicit dollar amounts', () => {
    expect(monthlyBudgetMicros(undefined)).toBe(0);
    expect(monthlyBudgetMicros('1')).toBe(1000000);
    expect(monthlyBudgetMicros('5.25')).toBe(5250000);
    for (const value of ['-1','NaN','1e3','0.001','101','']) expect(()=>monthlyBudgetMicros(value)).toThrow('INVALID_BUDGET');
  });
});
