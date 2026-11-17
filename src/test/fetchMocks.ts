import { vi } from 'vitest';

/** A fetch mock that answers every call with the given body and status. */
export function respondWith(body: unknown, init: { status?: number; raw?: boolean } = {}) {
  const text = init.raw ? String(body) : JSON.stringify(body);
  return vi.fn<typeof fetch>(async () => new Response(text, { status: init.status ?? 200 }));
}

/** A fetch mock that never answers until its signal aborts — models a hung server. */
export function hangingFetch() {
  return vi.fn<typeof fetch>(
    (_input, init) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('The operation was aborted.', 'AbortError'));
        });
      }),
  );
}
