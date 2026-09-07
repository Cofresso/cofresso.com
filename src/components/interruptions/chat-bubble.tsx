'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { IconX } from '@/components/ui/icons';
import { track } from '@/lib/analytics/track';
import {
  chatGreeting,
  chatQuickReplies,
  type ChatQuickReply,
} from '@/lib/interruptions/chat-script';
import { interruptionsConfig } from '@/lib/interruptions/config';
import { cn } from '@/lib/utils';
import { useInterruptionState } from './state';

export const CHAT_STORAGE_KEY = 'cofresso:chat';

interface ChatSession {
  /** The visitor has opened the panel at least once, so stop nagging with the badge. */
  opened: boolean;
  /** Quick replies used so far, in order. The transcript is rebuilt from these. */
  replies: string[];
}

const EMPTY_SESSION: ChatSession = { opened: false, replies: [] };

/** Only ever called from event handlers and timers, never during render. */
function readSession(): ChatSession {
  try {
    const parsed: unknown = JSON.parse(window.sessionStorage.getItem(CHAT_STORAGE_KEY) ?? 'null');
    if (typeof parsed !== 'object' || parsed === null) return EMPTY_SESSION;
    const { opened, replies } = parsed as Record<string, unknown>;
    return {
      opened: opened === true,
      replies: Array.isArray(replies)
        ? replies.filter((r): r is string => typeof r === 'string')
        : [],
    };
  } catch {
    return EMPTY_SESSION;
  }
}

function writeSession(session: ChatSession) {
  try {
    window.sessionStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(session));
  } catch {
    /* storage unavailable — the transcript just will not survive a navigation */
  }
}

interface ChatMessage {
  id: string;
  from: 'agent' | 'visitor';
  text: string;
}

/**
 * Live-chat bubble. Bottom-right, `z-40`: above the page, below the cookie banner (`z-45`) and
 * the modals (`z-50`), and it lifts clear of the banner while that is on screen so both stay
 * clickable.
 *
 * Not a modal — it does not block the page, so it gets Escape and focus management but no focus
 * trap. The transcript is rebuilt from the quick-reply ids kept in sessionStorage rather than
 * stored as markup, which keeps the stored shape trivial and the render deterministic.
 */
export function ChatBubble() {
  const { chatOpen, setChatOpen, bannerOpen } = useInterruptionState();
  const [replies, setReplies] = useState<string[]>([]);
  const [typing, setTyping] = useState(false);
  const [unread, setUnread] = useState(false);
  const bubbleRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);

  const messages = useMemo<ChatMessage[]>(() => {
    const out: ChatMessage[] = [{ id: 'greeting', from: 'agent', text: chatGreeting }];
    replies.forEach((id, index) => {
      const reply = chatQuickReplies.find((r) => r.id === id);
      if (!reply) return;
      out.push({ id: `question-${index}`, from: 'visitor', text: reply.label });
      // The newest answer is withheld until the typing indicator has run its course.
      const isNewest = index === replies.length - 1;
      if (!(isNewest && typing))
        out.push({ id: `answer-${index}`, from: 'agent', text: reply.answer });
    });
    return out;
  }, [replies, typing]);

  // Unread badge. Skipped entirely once the visitor has opened the panel in this session.
  useEffect(() => {
    if (unread || chatOpen) return;
    if (readSession().opened) return;
    const timeout = setTimeout(() => setUnread(true), interruptionsConfig.chat.unreadAfterMs);
    return () => clearTimeout(timeout);
  }, [unread, chatOpen]);

  useEffect(() => {
    if (!typing) return;
    const timeout = setTimeout(() => setTyping(false), interruptionsConfig.chat.typingMs);
    return () => clearTimeout(timeout);
  }, [typing]);

  useEffect(() => {
    if (!chatOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setChatOpen(false);
    };
    document.addEventListener('keydown', onKey);
    const bubble = bubbleRef.current;
    panelRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      // Focus goes back to the bubble here rather than in the close handler: the bubble is
      // `display:none` while the panel is open, so focusing it before React has committed the
      // DOM that makes it visible again is silently a no-op and focus falls to <body>. This
      // cleanup runs after that commit, and it covers Escape as well as the close button.
      if (bubble?.isConnected) bubble.focus();
    };
  }, [chatOpen, setChatOpen]);

  useEffect(() => {
    const transcript = transcriptRef.current;
    if (transcript) transcript.scrollTop = transcript.scrollHeight;
  }, [messages]);

  const open = useCallback(() => {
    const session = readSession();
    setReplies(session.replies);
    setUnread(false);
    setChatOpen(true);
    writeSession({ opened: true, replies: session.replies });
    track({ name: 'chat_opened' });
  }, [setChatOpen]);

  const close = useCallback(() => setChatOpen(false), [setChatOpen]);

  const ask = useCallback(
    (reply: ChatQuickReply) => {
      const next = [...replies, reply.id];
      setReplies(next);
      setTyping(true);
      writeSession({ opened: true, replies: next });
    },
    [replies],
  );

  const bottom = bannerOpen ? 'bottom-36' : 'bottom-5';

  return (
    <>
      {chatOpen ? (
        <div
          ref={panelRef}
          tabIndex={-1}
          role="dialog"
          aria-label="Chat with Cofresso"
          data-testid="chat-panel"
          className={cn(
            'border-latte/30 bg-foam fixed right-4 z-40 flex max-h-[70vh] w-[min(22rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border shadow-2xl focus:outline-none sm:right-5',
            bottom,
          )}
        >
          <header className="bg-espresso text-foam flex items-center justify-between gap-3 px-4 py-3">
            <div>
              <p className="text-sm font-medium">Cofresso support</p>
              <p className="text-foam/70 text-xs">Usually replies in a few seconds</p>
            </div>
            <button
              type="button"
              onClick={close}
              aria-label="Close chat"
              className="hover:bg-foam/10 focus-visible:ring-foam rounded-full p-1.5 focus-visible:ring-2 focus-visible:outline-none"
            >
              <IconX width={18} height={18} />
            </button>
          </header>

          <div
            ref={transcriptRef}
            className="flex flex-1 flex-col gap-2 overflow-y-auto px-4 py-3"
            aria-live="polite"
          >
            {messages.map((message) => (
              <p
                key={message.id}
                data-testid="chat-message"
                data-from={message.from}
                className={cn(
                  'max-w-[85%] rounded-2xl px-3 py-2 text-sm',
                  message.from === 'agent'
                    ? 'bg-latte/20 text-espresso self-start'
                    : 'bg-copper text-foam self-end',
                )}
              >
                {message.text}
              </p>
            ))}
            {typing ? (
              <p
                className="bg-latte/20 text-latte self-start rounded-2xl px-3 py-2 text-sm"
                data-testid="chat-typing"
              >
                <span className="sr-only">Rae is typing</span>
                <span aria-hidden="true">···</span>
              </p>
            ) : null}
          </div>

          <div className="border-latte/30 flex flex-col gap-1.5 border-t px-4 py-3">
            <p className="text-latte text-xs">Pick a question:</p>
            {chatQuickReplies.map((reply, index) => (
              <button
                key={reply.id}
                type="button"
                onClick={() => ask(reply)}
                data-testid={`chat-reply-${index + 1}`}
                className="border-latte/40 text-espresso hover:border-espresso hover:bg-espresso/5 focus-visible:ring-espresso rounded-full border px-3 py-1.5 text-left text-sm focus-visible:ring-2 focus-visible:outline-none"
              >
                {reply.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <button
        ref={bubbleRef}
        type="button"
        onClick={chatOpen ? close : open}
        aria-expanded={chatOpen}
        aria-label={unread ? 'Open chat (1 unread message)' : 'Open chat'}
        data-testid="chat-bubble"
        className={cn(
          'bg-espresso text-foam hover:bg-espresso-dark focus-visible:ring-espresso focus-visible:ring-offset-cream fixed right-4 z-40 flex size-14 items-center justify-center rounded-full shadow-xl transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none sm:right-5',
          chatOpen ? 'hidden' : bottom,
        )}
      >
        <ChatIcon />
        {unread ? (
          <span
            data-testid="chat-unread"
            className="bg-copper text-foam absolute -top-0.5 -right-0.5 flex size-5 items-center justify-center rounded-full text-[11px] font-semibold"
          >
            1
          </span>
        ) : null}
      </button>
    </>
  );
}

function ChatIcon() {
  return (
    <svg
      width={24}
      height={24}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 12a8 8 0 0 1-8 8H8l-4 3v-4.6A8 8 0 0 1 13 4a8 8 0 0 1 8 8Z" />
      <path d="M9 11h.01M13 11h.01M17 11h.01" />
    </svg>
  );
}
