/**
 * The models panel: every slot of the free-model chain with today's usage against its
 * limit, and when it resets. Opens from a small icon in the Ask header.
 */

import { ModelsPanel } from '@/components/ask/ModelsPanel';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const payload = {
  note: 'Usage is what this server sent today (UTC); the providers count separately. Daily limits reset at midnight UTC (08:00 MYT).',
  models: [
    { slot: 'gemini-3.7-flash', model: 'gemini-3.7-flash', provider: 'googleapis', key: 'yes', calls: 5, tokens: 12000,
      limits: { rpd: 20, tpd: null }, usage_pct: 25, cooldown_s: 0, resets_at: '2026-08-24T00:00:00+00:00', last_error: '' },
    { slot: 'groq-gpt-oss-120b', model: 'openai/gpt-oss-120b', provider: 'groq', key: 'yes', calls: 40, tokens: 190000,
      limits: { rpd: 1000, tpd: 200000 }, usage_pct: 95, cooldown_s: 3600, resets_at: '2026-08-24T00:00:00+00:00', last_error: '429 -> 3600s' },
    { slot: 'cerebras-gemma-4-31b', model: 'gemma-4-31b', provider: 'cerebras', key: 'MISSING', calls: 0, tokens: 0,
      limits: { rpd: 14400, tpd: null }, usage_pct: 0, cooldown_s: 0, resets_at: '2026-08-24T00:00:00+00:00', last_error: '' },
  ],
};

afterEach(() => vi.unstubAllGlobals());

describe('ModelsPanel', () => {
  it('lists every slot with its usage, limit and reset time after the icon is clicked', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify(payload), { status: 200, headers: { 'Content-Type': 'application/json' } }))));
    render(<ModelsPanel />);
    fireEvent.click(screen.getByRole('button', { name: /models/i }));
    expect((await screen.findAllByText('gemini-3.7-flash')).length).toBeGreaterThan(0);   // slot name and model id coincide here
    expect(screen.getByText('groq-gpt-oss-120b')).toBeTruthy();
    expect(screen.getByText('openai/gpt-oss-120b')).toBeTruthy();
    expect(screen.getByText(/40 \/ 1,000 req/)).toBeTruthy();
    expect(screen.getByText(/190,000 \/ 200,000 tokens/)).toBeTruthy();
    expect(screen.getAllByText(/resets/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/no key/i)).toBeTruthy();
    expect(screen.getByText(/cooling/i)).toBeTruthy();
    expect(screen.getByText(/counted|this server/i)).toBeTruthy();
  });
});
