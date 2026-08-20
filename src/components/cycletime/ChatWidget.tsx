/**
 * ChatWidget — the floating "Ask the data" bubble + drawer.
 *
 * A Lottie-animated button pinned bottom-left of every cycle-time page.
 * Click: the chat opens in a left drawer (~38% wide). X or clicking away
 * closes it. The SAME <CycleTimeChat /> component also lives at
 * /cycle-time/ask as a full page — which UI wins is an open decision, so
 * both stay; the bubble simply hides on the page itself.
 *
 * The animation is BUNDLED (src/assets/chatbot-voice-assistant.json,
 * extracted from LottieFiles' .lottie zip) — prod is intranet-only, so a
 * CDN-hosted animation would be a blank circle on the shop floor.
 * "Voice Assistant / AI Chatbot" by Mau, lottiefiles.com, free licence.
 */

import { useState } from 'react';
// v3 API: named export, `src` prop. LottieSvg is the svg-only engine — this
// animation is plain vectors, so the full renderer would be dead weight.
import { LottieSvg } from 'lottie-react';

import chatbotAnim from '@/assets/chatbot-voice-assistant.json';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import CycleTimeChat from '@/pages/cycletime/CycleTimeChat';

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-label="Ask the data"
        title="Ask the data"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 left-6 z-40 h-16 w-16 overflow-hidden rounded-full
                   border border-border bg-card shadow-lg transition-transform
                   duration-200 hover:scale-110 active:scale-95"
      >
        <LottieSvg src={chatbotAnim} loop autoplay className="h-full w-full" />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        {/* Default Sheet caps at sm:max-w-sm — overridden: the chat needs
            room for tables. p-0 so the chat's own header owns the top. */}
        <SheetContent side="left" className="w-[38vw] min-w-[420px] p-0 sm:max-w-none">
          <SheetTitle className="sr-only">Ask the data</SheetTitle>
          <div className="h-full">
            <CycleTimeChat />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
