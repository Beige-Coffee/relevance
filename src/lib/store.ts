"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ChatMessage } from "./types";
import type { Provider } from "./anthropic";
import { DEFAULT_MODELS } from "./anthropic";

interface Settings {
  provider: Provider;
  anthropicKey: string;
  openrouterKey: string;
  anthropicModel: string;
  openrouterModel: string;
  // When true, pressing Enter (without modifier) sends the message and
  // Shift+Enter inserts a newline. When false, the inverse: Enter inserts
  // a newline and Cmd/Ctrl+Enter sends.
  enterToSend: boolean;
  setProvider: (p: Provider) => void;
  setAnthropicKey: (k: string) => void;
  setOpenrouterKey: (k: string) => void;
  setAnthropicModel: (m: string) => void;
  setOpenrouterModel: (m: string) => void;
  setEnterToSend: (v: boolean) => void;
  activeKey: () => string;
  activeModel: () => string;
  hasKey: () => boolean;
}

// Temporary while the /api/v1/messages shared-key proxy is enabled.
// Setting this to true makes hasKey() always return true so the chat is
// usable without the user pasting their own key. If the proxy 503s
// because OPENROUTER_API_KEY isn't set in Vercel env, the user sees the
// proxy's error and can still paste their own key from the Settings
// page. To restore strict BYOK: flip this to false (and ideally also
// delete src/app/api/v1/messages/route.ts and the makeSharedProxyClient
// fallback in src/lib/anthropic.ts).
const SHARED_PROXY_ENABLED = true;

export const useSettings = create<Settings>()(
  persist(
    (set, get) => ({
      provider: "anthropic",
      anthropicKey: "",
      openrouterKey: "",
      anthropicModel: DEFAULT_MODELS.anthropic,
      openrouterModel: DEFAULT_MODELS.openrouter,
      enterToSend: false,
      setProvider: (p) => set({ provider: p }),
      setAnthropicKey: (k) => set({ anthropicKey: k.trim() }),
      setOpenrouterKey: (k) => set({ openrouterKey: k.trim() }),
      setAnthropicModel: (m) => set({ anthropicModel: m }),
      setOpenrouterModel: (m) => set({ openrouterModel: m }),
      setEnterToSend: (v) => set({ enterToSend: v }),
      activeKey: () => (get().provider === "anthropic" ? get().anthropicKey : get().openrouterKey),
      activeModel: () => (get().provider === "anthropic" ? get().anthropicModel : get().openrouterModel),
      hasKey: () => Boolean(get().activeKey()) || SHARED_PROXY_ENABLED,
    }),
    { name: "amc-settings-v2" }
  )
);

// Chat threads are persisted to localStorage so users can come back to a
// concept or a Conversation module and continue where they left off. Each
// component computes a thread key for the topic it's about (e.g.
// "home:concept:relevance-realization", "course:relevance-realization:2")
// and grabs that thread via the useThread() helper.

interface ChatThreadsState {
  threads: Record<string, ChatMessage[]>;
  isStreaming: boolean;
  appendTo: (key: string, m: ChatMessage) => void;
  setLastContentOf: (key: string, content: string, citations?: ChatMessage["citations"]) => void;
  patchLastOf: (key: string, patch: Partial<ChatMessage>) => void;
  setStreaming: (v: boolean) => void;
  resetThread: (key: string) => void;
}

export const useChatThreads = create<ChatThreadsState>()(
  persist(
    (set) => ({
      threads: {},
      isStreaming: false,
      appendTo: (key, m) =>
        set((s) => ({
          threads: { ...s.threads, [key]: [...(s.threads[key] ?? []), m] },
        })),
      setLastContentOf: (key, content, citations) =>
        set((s) => {
          const arr = s.threads[key] ?? [];
          if (arr.length === 0) return s;
          const updated = [...arr];
          const last = updated[updated.length - 1];
          updated[updated.length - 1] = {
            ...last,
            content,
            citations: citations ?? last.citations,
          };
          return { threads: { ...s.threads, [key]: updated } };
        }),
      patchLastOf: (key, patch) =>
        set((s) => {
          const arr = s.threads[key] ?? [];
          if (arr.length === 0) return s;
          const updated = [...arr];
          updated[updated.length - 1] = { ...updated[updated.length - 1], ...patch };
          return { threads: { ...s.threads, [key]: updated } };
        }),
      setStreaming: (v) => set({ isStreaming: v }),
      resetThread: (key) =>
        set((s) => {
          const next = { ...s.threads };
          delete next[key];
          return { threads: next };
        }),
    }),
    {
      name: "amc-chat-threads-v1",
      // Don't persist transient streaming flag.
      partialize: (s) => ({ threads: s.threads }) as Partial<ChatThreadsState>,
    },
  ),
);

// Stable empty-array reference so the useThread selector returns the same
// value across renders when the thread doesn't exist yet. Returning a fresh
// `[]` each call makes useSyncExternalStore think the snapshot changed and
// triggers an infinite render loop (Next.js prints the "getServerSnapshot
// should be cached" warning).
const EMPTY_THREAD: readonly ChatMessage[] = Object.freeze([]);

/**
 * Hook that scopes the threaded chat store to a single topic key. Returns
 * the same interface as the old useChat() store so callers only need to
 * pick a key.
 *
 * Pass a `null` key during loading states (e.g. waiting on async data) and
 * the hook returns an inert empty thread without persisting noise.
 */
export function useThread(key: string | null) {
  const messages = useChatThreads((s) =>
    key ? s.threads[key] ?? (EMPTY_THREAD as ChatMessage[]) : (EMPTY_THREAD as ChatMessage[]),
  );
  const isStreaming = useChatThreads((s) => s.isStreaming);
  const setStreaming = useChatThreads((s) => s.setStreaming);
  const appendTo = useChatThreads((s) => s.appendTo);
  const setLastContentOf = useChatThreads((s) => s.setLastContentOf);
  const patchLastOf = useChatThreads((s) => s.patchLastOf);
  const resetThread = useChatThreads((s) => s.resetThread);

  return {
    messages,
    isStreaming,
    setStreaming,
    append: (m: ChatMessage) => {
      if (!key) return;
      appendTo(key, m);
    },
    setLastContent: (content: string, citations?: ChatMessage["citations"]) => {
      if (!key) return;
      setLastContentOf(key, content, citations);
    },
    patchLast: (patch: Partial<ChatMessage>) => {
      if (!key) return;
      patchLastOf(key, patch);
    },
    reset: () => {
      if (!key) return;
      resetThread(key);
    },
  };
}

// Backwards-compat alias around a "global:free" thread. Currently unused
// in the live UI but kept around as a useful escape hatch.
export function useChat() {
  return useThread("global:free");
}
