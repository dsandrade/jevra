import { codexUsage, jevUsage } from '../../packages/core/src/accounting.ts';
import type { Invocation, Reservation } from '../../packages/core/src/accounting.ts';
import type { ReaderReceipt } from '../../packages/core/src/reader.ts';
export { wholeTaskUsage, reconcileInvocations, codexUsage, claudeUsage, jevUsage } from '../../packages/core/src/accounting.ts';

/** Only reads runtime journals; model output is never invocation or quality evidence. */
export function readerInvocations(receipt: ReaderReceipt): { reservations: Reservation[]; journals: Invocation[] } {
  const journals: Invocation[] = receipt.decisions.map(d => ({ id: d.id, component: 'managed_jev',
    status: d.status, usage: jevUsage(d.usage) }));
  for (const g of receipt.generations) journals.push({ id: g.id, component: 'worker', status: g.status,
    usage: codexUsage(g.receipt?.usage ?? null), usageComplete: g.receipt?.usageComplete ?? false });
  return { reservations: journals.map(({ id, component }) => ({ id, component })), journals };
}
