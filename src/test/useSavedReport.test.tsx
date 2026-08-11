/**
 * Guards the write path: a report must end up as ONE row in saved_reports no
 * matter how much it is edited. The failure is silent — the UI still says
 * "Saved" while quietly accumulating duplicates.
 *
 * What these cover: the first write INSERTs, every later one UPDATEs the id it
 * created, repeated edits do not multiply rows, and the payload carries `v`.
 *
 * What they do NOT cover: the stale-closure race the hook's `loadedIdRef`
 * comment describes — a timer scheduled before a DIRECT persist() resolves, so
 * it fires holding the pre-insert id. Verified by hand that swapping the ref for
 * the state value still passes every test below, so do not read a green run as
 * proof that ref is unnecessary. Reproducing it needs a two-writer harness.
 */

import { useSavedReport } from '@/hooks/shared/useSavedReport';
import type { SavedReportsClient } from '@/lib/shared/savedReportsApi';
import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/shared/savedReportsApi', async (orig) => ({
  ...(await orig<typeof import('@/lib/shared/savedReportsApi')>()),
  fetchUserInfo: async () => ({ userNtid: '4033375', userName: 'Faiz', userEmail: 'f@j.com' }),
}));

/** Stand-in backend: INSERT when no id, UPDATE when there is one. */
function fakeApi() {
  const rows = new Map<number, { name: string; payload: unknown }>();
  let nextId = 1;
  const calls: Array<{ id: number | null | undefined; name: string }> = [];

  const api: SavedReportsClient = {
    list: async () => [],
    load: async (id) => ({ id, payload: rows.get(id)?.payload } as never),
    remove: async () => ({ deleted: 1 }),
    save: async ({ id, name, payload }) => {
      calls.push({ id, name });
      // Deliberately slow, so a second call can overlap if the chain is broken.
      await new Promise(r => setTimeout(r, 20));
      const rowId = id ?? nextId++;
      rows.set(rowId, { name, payload });
      return { id: rowId, name, created_at: '', updated_at: '' };
    },
  };
  return { api, rows, calls };
}

function Harness({ api, content }: { api: SavedReportsClient; content: string }) {
  const saved = useSavedReport({ api, name: 'Report', payload: { content } });
  return <span data-testid="state">{saved.dirty ? 'dirty' : 'clean'}:{saved.loadedId ?? '-'}</span>;
}

describe('useSavedReport', () => {
  beforeEach(() => vi.useRealTimers());

  it('starts clean — the initial content is the baseline, not a pending write', async () => {
    const { api, calls } = fakeApi();
    render(<Harness api={api} content="a" />);
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('clean:-'));
    expect(calls).toHaveLength(0);
  });

  it('INSERTs once, then UPDATEs the same row on every later autosave', async () => {
    const { api, rows, calls } = fakeApi();
    const { rerender } = render(<Harness api={api} content="a" />);
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('clean:-'));

    rerender(<Harness api={api} content="b" />);
    await waitFor(() => expect(calls).toHaveLength(1), { timeout: 3000 });
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('clean:1'));
    expect(calls[0].id).toBeFalsy();                 // first write inserts

    rerender(<Harness api={api} content="c" />);
    await waitFor(() => expect(calls).toHaveLength(2), { timeout: 3000 });

    // The second write must carry the id the first one created. Losing this
    // gives one report two rows.
    expect(calls[1].id).toBe(1);
    expect(rows.size).toBe(1);
  });

  it('edits during an in-flight save still land on one row', async () => {
    const { api, rows } = fakeApi();
    const { rerender } = render(<Harness api={api} content="a" />);
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('clean:-'));

    // Type, let the write start, type again while it is still going.
    rerender(<Harness api={api} content="b" />);
    await waitFor(() => expect(rows.size).toBe(1), { timeout: 3000 });
    rerender(<Harness api={api} content="c" />);
    await act(async () => { await new Promise(r => setTimeout(r, 1500)); });

    expect(rows.size).toBe(1);
    expect(rows.get(1)?.payload).toMatchObject({ content: 'c' });
  });

  it('stamps the payload version so a future shape change can migrate', async () => {
    const { api, rows } = fakeApi();
    const { rerender } = render(<Harness api={api} content="a" />);
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('clean:-'));
    rerender(<Harness api={api} content="b" />);
    await waitFor(() => expect(rows.size).toBe(1), { timeout: 3000 });
    expect(rows.get(1)?.payload).toMatchObject({ v: 1 });
  });
});
