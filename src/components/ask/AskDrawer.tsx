/**
 * AskDrawer — the floating "Ask" bubble on every page + a right drawer (70vw)
 * with the same Chat inside. Hidden on the Ask page itself. A chat started here
 * keeps its thread for the session; "Open full page" continues it on /ask.
 */

import { Chat } from '@/components/ask/Chat';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { askApi } from '@/lib/ask/askApi';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink, MessageSquare } from 'lucide-react';
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export function AskDrawer() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [chatKey, setChatKey] = useState(0);          // remount only on "New chat", never mid-stream
  const thread = useQuery({
    queryKey: ['ask', 'thread', threadId],
    queryFn: () => askApi.threads.get(threadId!),
    enabled: open && Boolean(threadId),
  });

  if (pathname.startsWith('/ask')) return null;

  return (
    <>
      <Button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Ask the Jabil Universe"
        className="fixed bottom-5 right-5 z-40 h-12 gap-2 rounded-full px-4 shadow-lg"
      >
        <MessageSquare className="size-5" />
        <span className="hidden sm:inline">Ask</span>
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="flex w-[70vw] min-w-[420px] flex-col p-0 sm:max-w-none">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <SheetTitle className="text-sm font-semibold">Ask the Jabil Universe</SheetTitle>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="ghost" onClick={() => { setThreadId(null); setChatKey((k) => k + 1); }}>New chat</Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => { setOpen(false); navigate(threadId ? `/ask/t/${threadId}` : '/ask'); }}
              >
                <ExternalLink className="size-4" />
                Open full page
              </Button>
            </div>
          </div>
          <div className="min-h-0 flex-1">
            <Chat key={chatKey} thread={thread.data ?? null} onThreadCreated={setThreadId} compact />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
