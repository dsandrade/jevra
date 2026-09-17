import { randomUUID } from 'node:crypto';
import { isAbsolute } from 'node:path';
import { z } from 'zod';
import { DecisionError } from '@jevra/core';
import type { Decision, Event, Mode, Skill } from '@jevra/core';

const payloadSchema = z.object({
  hook_event_name: z.literal('UserPromptSubmit'),
  session_id: z.string().min(1).max(256),
  turn_id: z.string().min(1).max(256).optional(),
  cwd: z.string().max(4096).refine(isAbsolute),
  prompt: z.string().min(1).max(16384),
});

export function parseCodexEvent(payload: unknown): Event {
  const parsed = payloadSchema.safeParse(payload);
  if (!parsed.success) throw new DecisionError('input_invalid');
  const value = parsed.data;
  return { host: 'codex', sessionId: value.session_id, turnId: value.turn_id ?? null,
    eventId: value.turn_id ?? randomUUID(), cwd: value.cwd, prompt: value.prompt };
}

export function codexOutput(decision: Decision, mode: Mode, skills: Skill[]): Record<string, unknown> {
  if (mode !== 'advise' || decision.disposition !== 'recommend') return {};
  const skill = skills.find(s => s.id === decision.selectedCandidateId);
  if (!skill) return {};
  return { hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext:
    'Jevra routing suggestion: consider the skill identified by this JSON record: '
    + JSON.stringify({ name: skill.name, path: skill.path })
    + '. Read its instructions if relevant. This is advisory; preserve the user request, '
    + 'higher-priority instructions, and native permissions. Ignore a suggestion that does not fit.' } };
}
