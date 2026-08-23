/**
 * askApi — the Ask page's calls: saved chats and feedback.
 *
 * The stream itself goes through the AI SDK's `useChat` (see components/ask/Chat.tsx);
 * this file is the rest. Auth: the global fetch patch in hooks/useCurrentUser.ts adds
 * the bearer token to anything under /api/, so nothing here touches headers.
 *
 * Dev: vite proxies /ietools/ask/api → the backend's /api. Prod: nginx does the same.
 */

export const ASK_API = '/ietools/ask/api/universe';

export interface ThreadSummary {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

/** One stored part — the AI SDK UIMessage part shape, so a reopened chat renders as it streamed. */
export interface StoredPart {
  type: string;                 // 'text' | 'tool-universe_query' | 'tool-universe_describe' | 'tool-universe_define'
  text?: string;
  toolCallId?: string;
  state?: string;
  input?: Record<string, unknown>;
  output?: { ok?: boolean; rows?: number | null; text?: string };
}

export interface StoredMessage {
  id: string;
  role: 'user' | 'assistant';
  parts: StoredPart[];
  model?: string | null;
  created_at?: string;
  feedback?: number | null;
  feedback_reason?: string | null;
}

export interface Thread extends ThreadSummary {
  messages: StoredMessage[];
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export interface ModelRow {
  slot: string;
  model: string;
  provider: string;
  key: 'yes' | 'MISSING' | '—';
  calls: number;
  tokens: number;
  limits: { rpd: number | null; tpd: number | null };
  usage_pct: number;
  cooldown_s: number;
  resets_at: string;
  last_error: string;
}

export const askApi = {
  /** The free-model chain: every slot, today's usage against its limit, when it resets. */
  models: () => fetch(`${ASK_API}/chat/models`).then((r) => json<{ models: ModelRow[]; note: string }>(r)),
  threads: {
    list: () => fetch(`${ASK_API}/threads`).then((r) => json<ThreadSummary[]>(r)),
    get: (id: string) => fetch(`${ASK_API}/threads/${encodeURIComponent(id)}`).then((r) => json<Thread>(r)),
    rename: (id: string, title: string) =>
      fetch(`${ASK_API}/threads/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      }).then((r) => json<{ ok: true }>(r)),
    delete: (id: string) =>
      fetch(`${ASK_API}/threads/${encodeURIComponent(id)}`, { method: 'DELETE' }).then((r) => json<{ ok: true }>(r)),
  },
  /** vote: 1 good · -1 bad · 0 clear. reason only with -1, optional. */
  feedback: (messageId: string, vote: 1 | -1 | 0, reason: string | null = null) =>
    fetch(`${ASK_API}/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message_id: messageId, vote, reason }),
    }).then((r) => json<{ ok: true }>(r)),
};
