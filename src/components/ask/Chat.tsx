/**
 * Chat — one conversation with the Jabil Universe.
 *
 * The question sits in a bubble; the answer flows full-width like a document
 * (markdown: tables, headers, lists, links, code). Each tool step the model took
 * ("ran SQL → 40 rows") is a folded card under the answer. Thumbs under every
 * answer; thumbs-down asks for an optional reason.
 *
 * Streaming: the AI SDK's useChat over our FastAPI endpoint, which speaks the
 * AI SDK UI message stream (see IE-Pulse-Backend/modules/universe/chat/stream.py).
 * A reopened chat renders from the stored parts — the same shapes the stream made.
 */

import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation';
import {
  Message,
  MessageAction,
  MessageActions,
  MessageContent,
  MessageResponse,
} from '@/components/ai-elements/message';
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  type PromptInputMessage,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from '@/components/ai-elements/prompt-input';
import { Tool, ToolContent, ToolHeader, ToolInput, ToolOutput, type ToolPart } from '@/components/ai-elements/tool';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { ASK_API, askApi, type StoredPart, type Thread } from '@/lib/ask/askApi';
import { cn } from '@/lib/utils';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage } from 'ai';
import { MessageSquare, ThumbsDown, ThumbsUp } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export const EXAMPLES = [
  'How many workcells are physically in P1?',
  'How do you calculate OLE?',
  'Project the next 3 weeks of demand for KEYSIGHT',
];

const TOOL_TITLES: Record<string, string> = {
  'tool-universe_describe': 'Looked up the schema',
  'tool-universe_query': 'Ran a query',
  'tool-universe_define': 'Looked up a definition',
};

/** Stored parts are already UIMessage parts; only the typing differs. */
function toUIMessages(thread: Thread | null): UIMessage[] {
  return (thread?.messages ?? []).map((m) => ({ id: m.id, role: m.role, parts: m.parts as unknown as UIMessage['parts'] }));
}

export interface ChatProps {
  thread: Thread | null;
  /** Called once, when the backend opened a thread for a first question. */
  onThreadCreated?: (id: string) => void;
  /** Drawer mode: tighter spacing. */
  compact?: boolean;
  className?: string;
}

export function Chat({ thread, onThreadCreated, compact, className }: ChatProps) {
  // The thread id lives in a ref: a first question creates the thread mid-stream, and the
  // component must NOT remount (that would drop the stream) — it just learns the id.
  const threadIdRef = useRef<string | null>(thread?.id ?? null);
  const createdRef = useRef(onThreadCreated);
  createdRef.current = onThreadCreated;
  if (thread?.id) threadIdRef.current = thread.id;

  // `initial` and `chatId` are read once, at mount — a reopened chat renders its stored parts
  const [initial] = useState(() => toUIMessages(thread));
  const [chatId] = useState(() => thread?.id ?? `new-${Math.random().toString(36).slice(2)}`);
  const [transport] = useState(
    () =>
      new DefaultChatTransport({
        api: `${ASK_API}/chat`,
        body: () => ({ thread_id: threadIdRef.current }),
        // the backend names a new thread in a header; the page adopts it from here
        fetch: async (input, init) => {
          const res = await fetch(input, init);
          const id = res.headers.get('x-thread-id');
          if (id && !threadIdRef.current) {
            threadIdRef.current = id;
            createdRef.current?.(id);
          }
          return res;
        },
      }),
  );
  const { messages, sendMessage, setMessages, status, stop, error } = useChat({ id: chatId, messages: initial, transport });
  const busy = status === 'submitted' || status === 'streaming';

  // A thread that arrives after mount (the page fetched it while we were already on screen):
  // adopt its messages only when nothing is showing and nothing is streaming.
  const adoptedRef = useRef(false);
  useEffect(() => {
    if (thread && !adoptedRef.current && messages.length === 0 && !busy && thread.messages.length > 0) {
      adoptedRef.current = true;
      setMessages(toUIMessages(thread));
    }
  }, [thread, messages.length, busy, setMessages]);

  const ask = (text: string) => {
    const t = text.trim();
    if (t && !busy) sendMessage({ text: t });
  };
  const onSubmit = (m: PromptInputMessage) => ask(m.text ?? '');

  return (
    <div className={cn('flex h-full min-h-0 w-full flex-col', className)}>
      <Conversation className="min-h-0 flex-1">
        <ConversationContent className={cn('mx-auto w-full max-w-3xl', compact ? 'px-3 py-3' : 'px-4 py-6 sm:px-6')}>
          {messages.length === 0 ? (
            <ConversationEmptyState
              icon={<MessageSquare className="size-8 text-muted-foreground" />}
              title="Ask the Jabil Universe"
              description="Workcells, output, OLE, cycle time, routes, demand — in plain English. Try one:"
            >
              <div className="mt-2 flex flex-wrap justify-center gap-2">
                {EXAMPLES.map((q) => (
                  <Button key={q} variant="outline" size="sm" onClick={() => ask(q)}>
                    {q}
                  </Button>
                ))}
              </div>
            </ConversationEmptyState>
          ) : (
            messages.map((m) => <ChatMessage key={m.id} message={m} streaming={busy && m === messages[messages.length - 1]} />)
          )}
          {busy && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground" aria-live="polite">
              <Spinner className="size-4" />
              <span>Working…</span>
            </div>
          )}
          {error && (
            <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error.message || 'The request failed.'}
            </div>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className={cn('mx-auto w-full max-w-3xl', compact ? 'px-3 pb-3' : 'px-4 pb-4 sm:px-6')}>
        <PromptInput onSubmit={onSubmit}>
          <PromptInputBody>
            <PromptInputTextarea placeholder="Ask about workcells, output, OLE, cycle time, routes, demand…" disabled={busy} />
          </PromptInputBody>
          <PromptInputFooter>
            <PromptInputTools>
              <span className="px-1 text-xs text-muted-foreground">Enter to send · Shift+Enter for a new line</span>
            </PromptInputTools>
            <PromptInputSubmit status={status} onStop={stop} />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
}

function ChatMessage({ message, streaming }: { message: UIMessage; streaming: boolean }) {
  const isUser = message.role === 'user';
  return (
    <Message
      from={message.role}
      data-role={message.role}
      data-bubble={isUser ? 'yes' : 'none'}
      className={cn(!isUser && 'max-w-none')}
    >
      {isUser ? (
        <MessageContent>
          {message.parts.map((p, i) => (p.type === 'text' ? <span key={i} className="whitespace-pre-wrap">{p.text}</span> : null))}
        </MessageContent>
      ) : (
        <div className="flex w-full min-w-0 flex-col gap-3">
          {message.parts.map((p, i) => {
            if (p.type === 'text') {
              return <MessageResponse key={i}>{p.text}</MessageResponse>;
            }
            if (p.type.startsWith('tool-')) {
              const part = p as ToolPart;
              return (
                <Tool key={part.toolCallId ?? i} className="w-full">
                  <ToolHeader
                    type={part.type as never}
                    state={part.state}
                    title={`${TOOL_TITLES[part.type] ?? 'Tool'} · ${part.type.replace(/^tool-/, '')}`}
                  />
                  <ToolContent>
                    <ToolInput input={part.input} />
                    {part.state === 'output-available' && <ToolOutput output={<ToolText output={part.output} />} errorText={undefined} />}
                  </ToolContent>
                </Tool>
              );
            }
            return null;
          })}
          {!streaming && <Feedback messageId={message.id} initial={feedbackOf(message)} />}
        </div>
      )}
    </Message>
  );
}

/** The backend stores {ok, rows, text}; show the text the model saw. */
function ToolText({ output }: { output: unknown }) {
  const o = (output ?? {}) as { rows?: number | null; text?: string; ok?: boolean };
  return (
    <div className="space-y-1">
      {typeof o.rows === 'number' && <div className="text-xs text-muted-foreground">{o.rows} rows</div>}
      <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all text-xs">{o.text ?? JSON.stringify(output)}</pre>
    </div>
  );
}

function feedbackOf(message: UIMessage): number | null {
  const m = message as unknown as { feedback?: number | null };
  return m.feedback ?? null;
}

function Feedback({ messageId, initial }: { messageId: string; initial: number | null }) {
  const [vote, setVote] = useState<number | null>(initial);
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState('');

  const send = (v: 1 | -1 | 0, why: string | null = null) => {
    setVote(v || null);
    setAsking(false);
    askApi.feedback(messageId, v, why).catch(() => setVote(initial));
  };

  return (
    <div className="flex flex-col gap-2">
      <MessageActions>
        <MessageAction
          label="Good answer"
          tooltip="Good answer"
          aria-pressed={vote === 1}
          className={cn(vote === 1 && 'text-emerald-600')}
          onClick={() => send(vote === 1 ? 0 : 1)}
        >
          <ThumbsUp className="size-4" />
        </MessageAction>
        <MessageAction
          label="Bad answer"
          tooltip="Bad answer"
          aria-pressed={vote === -1}
          className={cn(vote === -1 && 'text-destructive')}
          onClick={() => (vote === -1 ? send(0) : setAsking(true))}
        >
          <ThumbsDown className="size-4" />
        </MessageAction>
      </MessageActions>
      {asking && (
        <div className="flex max-w-md flex-col gap-2 rounded-md border bg-muted/30 p-2">
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="What was wrong? (optional)"
            rows={2}
            className="text-sm"
          />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => send(-1, null)}>
              Skip
            </Button>
            <Button size="sm" onClick={() => send(-1, reason.trim() || null)}>
              Send
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export type { StoredPart };
