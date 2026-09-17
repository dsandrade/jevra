import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const [task, cwd] = process.argv.slice(2);
const checks = [];
const check = (name, fn) => { try { fn(); checks.push({ name, passed: true }); } catch { checks.push({ name, passed: false }); } };
try {
  if (task === 'retry-policy') {
    const { retryDecision: decide } = await import(pathToFileURL(resolve(cwd, 'src/retry.mjs')).href);
    const no = reason => ({ retry: false, delayMs: 0, reason });
    const yes = delayMs => ({ retry: true, delayMs, reason: 'retry' });
    for (const attempt of [0, -1, 1.5, NaN, undefined]) check(`invalid-attempt-${String(attempt)}`, () => assert.throws(() => decide({ attempt, status: 500 }), RangeError));
    check('exhausted-before-safety', () => assert.deepEqual(decide({ attempt: 4, status: 500 }), no('exhausted')));
    check('exhausted-before-permanent', () => assert.deepEqual(decide({ attempt: 5, status: 400 }), no('exhausted')));
    for (const status of [200, 400, 404, 501, 505]) check(`permanent-${status}`, () => assert.deepEqual(decide({ attempt: 1, status, idempotent: true }), no('permanent')));
    for (const status of [429, 500, 502, 503, 504, 599]) check(`transient-${status}`, () => assert.deepEqual(decide({ attempt: 1, status, idempotent: true }), yes(200)));
    check('unsafe-write', () => assert.deepEqual(decide({ attempt: 1, status: 503, idempotent: false }), no('unsafe')));
    check('blank-key-is-unsafe', () => assert.deepEqual(decide({ attempt: 1, status: 429, idempotencyKey: '  ' }), no('unsafe')));
    check('key-protects-write', () => assert.deepEqual(decide({ attempt: 2, status: 503, idempotencyKey: ' key ' }), yes(400)));
    for (const code of ['TIMEOUT', 'NETWORK_RESET']) check(`network-${code}`, () => assert.deepEqual(decide({ attempt: 3, code, idempotent: true }), yes(800)));
    check('unknown-code', () => assert.deepEqual(decide({ attempt: 1, code: 'BROKEN', idempotent: true }), no('permanent')));
    check('rounded-server-hint', () => assert.deepEqual(decide({ attempt: 1, status: 429, idempotent: true, retryAfterMs: 301.2 }), yes(302)));
    check('bounded-server-hint', () => assert.deepEqual(decide({ attempt: 2, status: 503, idempotent: true, retryAfterMs: 12000 }), yes(10000)));
    check('small-hint-does-not-lower-base', () => assert.deepEqual(decide({ attempt: 3, status: 503, idempotent: true, retryAfterMs: 10 }), yes(800)));
    for (const hint of [-1, Infinity, NaN, '500']) check(`ignored-hint-${String(hint)}`, () => assert.deepEqual(decide({ attempt: 1, status: 503, idempotent: true, retryAfterMs: hint }), yes(200)));
    check('hint-not-used-for-other-status', () => assert.deepEqual(decide({ attempt: 1, status: 500, idempotent: true, retryAfterMs: 5000 }), yes(200)));
  } else if (task === 'retention-policy') {
    const { planPurge: plan } = await import(pathToFileURL(resolve(cwd, 'src/retention.mjs')).href);
    const now = '2026-09-01T00:00:00.000Z', day = 86400000;
    const record = (id, age, category = 'audit', extra = {}) => ({ id, accountId: 'account-a', category,
      createdAt: new Date(Date.parse(now) - age * day).toISOString(), legalHold: false, accountActive: false, ...extra });
    check('invalid-now', () => assert.throws(() => plan([], 'invalid'), TypeError));
    for (const [category, window] of [['session', 7], ['audit', 90]]) {
      check(`${category}-boundary`, () => assert.deepEqual(plan([record('keep', window, category), record('delete', window + 0.000001, category)], now), ['delete']));
    }
    check('legal-hold', () => assert.deepEqual(plan([record('hold', 200, 'audit', { legalHold: true })], now), []));
    check('active-session', () => assert.deepEqual(plan([record('active', 200, 'session', { accountActive: true })], now), []));
    check('active-audit-can-expire', () => assert.deepEqual(plan([record('audit', 100, 'audit', { accountActive: true })], now), ['audit']));
    check('unknown-category', () => assert.deepEqual(plan([record('unknown', 1000, 'custom')], now), []));
    check('invalid-created-at', () => assert.deepEqual(plan([record('invalid', 100, 'session', { createdAt: 'invalid' })], now), []));
    check('future-record', () => assert.deepEqual(plan([record('future', -100, 'session')], now), []));
    check('retain-newest-old-report', () => assert.deepEqual(plan([record('old', 100, 'report'), record('new', 90, 'report')], now), ['old']));
    check('tied-newest-reports', () => assert.deepEqual(plan([record('a', 100, 'report'), record('b', 90, 'report'), record('c', 90, 'report')], now), ['a']));
    check('per-account-newest', () => assert.deepEqual(plan([record('a', 100, 'report'), record('b', 90, 'report', { accountId: 'b' })], now), []));
    check('held-newest-still-compared', () => assert.deepEqual(plan([record('a', 100, 'report'), record('b', 90, 'report', { legalHold: true })], now), ['a']));
    check('invalid-report-is-not-newest', () => assert.deepEqual(plan([record('a', 100, 'report'), record('b', 90, 'report', { createdAt: 'invalid' })], now), []));
    check('report-exact-boundary', () => assert.deepEqual(plan([record('a', 30, 'report'), record('b', 0, 'report')], now), []));
    check('report-expired-boundary', () => assert.deepEqual(plan([record('a', 30.000001, 'report'), record('b', 0, 'report')], now), ['a']));
    check('sorted-ids', () => assert.deepEqual(plan([record('z', 200), record('a', 200)], now), ['a', 'z']));
    check('no-input-mutation', () => { const input = [record('z', 200), record('a', 200)]; const before = structuredClone(input); plan(input, now); assert.deepEqual(input, before); });
  } else throw new Error('unknown task');
} catch { checks.push({ name: 'load-and-evaluate-module', passed: false }); }
console.log(JSON.stringify({ task, checks, passed: checks.length > 0 && checks.every(c => c.passed) }));
