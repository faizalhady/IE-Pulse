/**
 * The Ask chat renders a saved thread the way it streamed: the user's question in a
 * bubble, the answer flat as a document (markdown, no bubble), the tool step as a
 * folded card — and the thumbs post feedback for the message they sit under.
 * Written before the component (spec: IE-Pulse-Backend/docs/superpowers/specs/2026-08-23-universe-chat-design.md).
 */

import { Chat } from '@/components/ask/Chat';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const thread = {
  id: 't1',
  title: 'how many workcells are in P1',
  created_at: '2026-08-23T05:00:00',
  updated_at: '2026-08-23T05:00:00',
  messages: [
    { id: 'u1', role: 'user' as const, parts: [{ type: 'text', text: 'how many workcells are in P1' }] },
    {
      id: 'a1',
      role: 'assistant' as const,
      parts: [
        {
          type: 'tool-universe_query',
          toolCallId: 'c1',
          state: 'output-available',
          input: { sql: 'select count(*) as n from v_workcell' },
          output: { ok: true, rows: 1, text: '{"rows":[{"n":18}]}' },
        },
        { type: 'text', text: '**18** workcells are physically in P1.\n\n| plant | count |\n|---|---|\n| P1 | 18 |' },
      ],
    },
  ],
};

function okJson(body: unknown) {
  return Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } }));
}

afterEach(() => vi.unstubAllGlobals());

describe('Chat', () => {
  it('shows the question in a bubble and the answer flat, as markdown', () => {
    render(<Chat thread={thread} />);
    const question = screen.getByText('how many workcells are in P1');
    expect(question.closest('[data-role="user"]')).not.toBeNull();
    const answer = screen.getByText(/workcells are physically in P1/);
    const assistant = answer.closest('[data-role="assistant"]');
    expect(assistant).not.toBeNull();
    expect(assistant?.getAttribute('data-bubble')).toBe('none');
    expect(assistant?.querySelector('table')).not.toBeNull();          // markdown rendered, not raw pipes
    expect(assistant?.textContent).not.toContain('**');                 // bold consumed by the renderer
  });

  it('folds the tool step under the answer, named after the tool', () => {
    render(<Chat thread={thread} />);
    expect(screen.getByText(/universe_query/)).toBeTruthy();
    expect(screen.queryByText(/select count\(\*\) as n from v_workcell/)).toBeNull();     // folded
  });

  it('thumbs up posts +1 for that message', async () => {
    const fetchMock = vi.fn(() => okJson({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);
    render(<Chat thread={thread} />);
    fireEvent.click(screen.getByRole('button', { name: /good answer/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/\/api\/universe\/feedback$/);
    expect(JSON.parse(String(init.body))).toEqual({ message_id: 'a1', vote: 1, reason: null });
  });

  it('thumbs down asks for an optional reason, then posts -1 with it', async () => {
    const fetchMock = vi.fn(() => okJson({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);
    render(<Chat thread={thread} />);
    fireEvent.click(screen.getByRole('button', { name: /bad answer/i }));
    const box = await screen.findByPlaceholderText(/what was wrong/i);
    fireEvent.change(box, { target: { value: 'wrong plant' } });
    fireEvent.click(screen.getByRole('button', { name: /send/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({ message_id: 'a1', vote: -1, reason: 'wrong plant' });
  });

  it('offers example questions when the thread is empty', () => {
    render(<Chat thread={null} />);
    expect(screen.getAllByRole('button', { name: /workcell|OLE|demand/i }).length).toBeGreaterThanOrEqual(3);
  });
});
