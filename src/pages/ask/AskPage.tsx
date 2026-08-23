/**
 * AskPage — /ask and /ask/t/:threadId.
 * Left: my saved chats (new, reopen, rename, delete). Right: the conversation.
 */

import { Chat } from '@/components/ask/Chat';
import { ModelsPanel } from '@/components/ask/ModelsPanel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { askApi, type ThreadSummary } from '@/lib/ask/askApi';
import { cn } from '@/lib/utils';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, MessageSquarePlus, Pencil, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

export default function AskPage() {
  const { threadId } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const threads = useQuery({ queryKey: ['ask', 'threads'], queryFn: askApi.threads.list });
  const thread = useQuery({
    queryKey: ['ask', 'thread', threadId],
    queryFn: () => askApi.threads.get(threadId!),
    enabled: Boolean(threadId),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['ask', 'threads'] });
  const rename = useMutation({ mutationFn: ({ id, title }: { id: string; title: string }) => askApi.threads.rename(id, title), onSuccess: invalidate });
  const remove = useMutation({
    mutationFn: (id: string) => askApi.threads.delete(id),
    onSuccess: (_r, id) => {
      invalidate();
      if (id === threadId) fresh();
    },
  });

  const forbidden = threads.error && /403|pilot/i.test(String(threads.error));
  const signedOut = threads.error && /401|sign-in/i.test(String(threads.error));

  // The Chat remounts only when the user opens another chat or starts a new one — never
  // when a first question creates its thread (the URL updates, the stream keeps flowing).
  const [chatKey, setChatKey] = useState(0);
  const open = (id: string) => { navigate(`/ask/t/${id}`); setChatKey((k) => k + 1); };
  const fresh = () => { navigate('/ask'); setChatKey((k) => k + 1); };

  return (
    <div className="flex h-full w-full">
      <aside className="hidden w-64 shrink-0 flex-col border-r bg-muted/20 md:flex">
        <div className="flex items-center justify-between px-3 pb-2 pt-4">
          <h1 className="text-sm font-semibold">Ask</h1>
          <div className="flex items-center gap-1">
            <ModelsPanel />
            <Button size="sm" variant="outline" onClick={fresh} aria-label="New chat">
              <MessageSquarePlus className="size-4" />
              New chat
            </Button>
          </div>
        </div>
        <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
          {threads.isLoading && <p className="px-2 py-2 text-xs text-muted-foreground">Loading…</p>}
          {forbidden && <p className="px-2 py-2 text-xs text-muted-foreground">The chat is in pilot — ask Faiz for access.</p>}
          {signedOut && <p className="px-2 py-2 text-xs text-muted-foreground">Sign-in required — connect to the Jabil network (VPN), then refresh.</p>}
          {(threads.data ?? []).map((t) => (
            <ThreadRow
              key={t.id}
              thread={t}
              active={t.id === threadId}
              onOpen={() => open(t.id)}
              onRename={(title) => rename.mutate({ id: t.id, title })}
              onDelete={() => remove.mutate(t.id)}
            />
          ))}
          {threads.data && threads.data.length === 0 && (
            <p className="px-2 py-2 text-xs text-muted-foreground">No chats yet. Ask something.</p>
          )}
        </nav>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col">
        {/* Always mounted: a thread fetched after mount is adopted by the Chat itself, so a
            first question's stream is never interrupted by the URL gaining its thread id. */}
        <Chat
          key={chatKey}
          thread={thread.data ?? null}
          onThreadCreated={(id) => {
            invalidate();
            navigate(`/ask/t/${id}`, { replace: true });
          }}
        />
      </section>
    </div>
  );
}

function ThreadRow({
  thread, active, onOpen, onRename, onDelete,
}: { thread: ThreadSummary; active: boolean; onOpen: () => void; onRename: (t: string) => void; onDelete: () => void }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(thread.title);
  const [confirming, setConfirming] = useState(false);

  if (editing) {
    return (
      <form
        className="flex items-center gap-1 px-1 py-1"
        onSubmit={(e) => { e.preventDefault(); onRename(title.trim() || thread.title); setEditing(false); }}
      >
        <Input value={title} onChange={(e) => setTitle(e.target.value)} className="h-7 text-xs" autoFocus aria-label="Chat title" />
        <Button type="submit" size="icon" variant="ghost" className="size-7" aria-label="Save title"><Check className="size-3.5" /></Button>
        <Button type="button" size="icon" variant="ghost" className="size-7" aria-label="Cancel" onClick={() => setEditing(false)}><X className="size-3.5" /></Button>
      </form>
    );
  }
  return (
    <div className={cn('group flex items-center gap-1 rounded-md px-1', active ? 'bg-accent' : 'hover:bg-accent/60')}>
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 truncate py-2 text-left text-xs" title={thread.title}>
        {thread.title}
      </button>
      {confirming ? (
        <>
          <Button size="sm" variant="destructive" className="h-6 px-2 text-[11px]" onClick={onDelete}>Delete</Button>
          <Button size="icon" variant="ghost" className="size-6" aria-label="Keep" onClick={() => setConfirming(false)}><X className="size-3" /></Button>
        </>
      ) : (
        <div className="hidden items-center group-hover:flex">
          <Button size="icon" variant="ghost" className="size-6" aria-label="Rename chat" onClick={() => setEditing(true)}><Pencil className="size-3" /></Button>
          <Button size="icon" variant="ghost" className="size-6" aria-label="Delete chat" onClick={() => setConfirming(true)}><Trash2 className="size-3" /></Button>
        </div>
      )}
    </div>
  );
}
