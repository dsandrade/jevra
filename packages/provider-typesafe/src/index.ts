import { TypeSafeClient } from '@typesafe-ai/sdk';
import type { Fetch } from '@typesafe-ai/sdk';
import { DecisionError } from '@jevra/core';
import type { Provider, ProviderRequest } from '@jevra/core';

export function createTypeSafeProvider(options: {
  getApiKey: () => Promise<string | undefined>;
  fetch?: Fetch;
}): Provider {
  return {
    async evaluate(request: ProviderRequest, signal: AbortSignal): Promise<unknown> {
      signal.throwIfAborted();
      const apiKey = await options.getApiKey();
      signal.throwIfAborted();
      if (!apiKey?.trim()) throw new DecisionError('missing_credentials');
      // Explicit transport and logging settings prevent environment overrides from
      // redirecting credentials or dumping private request bodies through SDK logs.
      const client = new TypeSafeClient({
        apiKey,
        baseURL: 'https://api.typesafe.ai',
        logLevel: 'off',
        retry: { maxRetries: 0 },
        timeout: 10000,
        ...(options.fetch ? { fetch: options.fetch } : {}),
      });
      try {
        return await client.systemOne(request, { signal, retry: { maxRetries: 0 } });
      } catch (error) {
        if (signal.aborted) throw signal.reason;
        const status = (error as { status?: number }).status;
        if (status === 401 || status === 403) throw new DecisionError('authentication');
        if (status === 400 || status === 422) throw new DecisionError('invalid_request');
        if (status === 429) throw new DecisionError('rate_limited');
        if (status === 529 || status === 503) throw new DecisionError('overloaded');
        const name = error instanceof Error ? error.name : '';
        if (name.includes('Timeout')) throw new DecisionError('timeout');
        if (name.includes('Connection')) throw new DecisionError('network_error');
        if (name.includes('Parse') || error instanceof SyntaxError) throw new DecisionError('invalid_response');
        throw new DecisionError('provider_error');
      }
    },
  };
}
