import { hash, MODEL } from '@jevra/core';
import type { Event, Provider, ProviderRequest, ProviderResult, Skill } from '@jevra/core';

export const skills: Skill[] = [
  { id: 'skill_1111111111111111', name: 'change-review', description: 'Review code changes for defects.',
    path: '/synthetic/skills/change-review/SKILL.md', contentHash: hash('review') },
  { id: 'skill_2222222222222222', name: 'unit-test-author', description: 'Write unit tests for existing source code.',
    path: '/synthetic/skills/unit-test-author/SKILL.md', contentHash: hash('tests') },
];
export const event: Event = {
  host: 'codex', sessionId: 'synthetic-session', turnId: 'turn-1', eventId: 'turn-1',
  prompt: 'Inspect this patch for bugs before I merge it.', cwd: '/synthetic/project',
};

export function response(request: ProviderRequest, selected?: string): ProviderResult {
  const selection = request.questions.selection;
  if (selection?.type !== 'choice') throw new Error('Expected a selection question');
  const chosen = selected ?? Object.keys(selection.criteria)[1]!;
  return { model: MODEL, answers: {
    selection: { type: 'choice', choice: chosen, confidence: 0.95,
      probabilities: Object.fromEntries(Object.keys(selection.criteria).map(k => [k, k === chosen ? 1 : 0])) },
    multiple: { type: 'noul', noul: 0.01 },
  }, usage: { input_tokens: 200, output_tokens: 30 } };
}

export function fakeProvider(mutate?: (result: ProviderResult, request: ProviderRequest) => unknown): Provider {
  return { async evaluate(request) { const result = response(request); return mutate ? mutate(result, request) : result; } };
}
