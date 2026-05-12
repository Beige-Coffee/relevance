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
  setProvider: (p: Provider) => void;
  setAnthropicKey: (k: string) => void;
  setOpenrouterKey: (k: string) => void;
  setAnthropicModel: (m: string) => void;
  setOpenrouterModel: (m: string) => void;
  activeKey: () => string;
  activeModel: () => string;
  hasKey: () => boolean;
}

export const useSettings = create<Settings>()(
  persist(
    (set, get) => ({
      provider: "anthropic",
      anthropicKey: "",
      openrouterKey: "",
      anthropicModel: DEFAULT_MODELS.anthropic,
      openrouterModel: DEFAULT_MODELS.openrouter,
      setProvider: (p) => set({ provider: p }),
      setAnthropicKey: (k) => set({ anthropicKey: k.trim() }),
      setOpenrouterKey: (k) => set({ openrouterKey: k.trim() }),
      setAnthropicModel: (m) => set({ anthropicModel: m }),
      setOpenrouterModel: (m) => set({ openrouterModel: m }),
      activeKey: () => (get().provider === "anthropic" ? get().anthropicKey : get().openrouterKey),
      activeModel: () => (get().provider === "anthropic" ? get().anthropicModel : get().openrouterModel),
      hasKey: () => Boolean(get().activeKey()),
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

/**
 * Hook that scopes the threaded chat store to a single topic key. Returns
 * the same interface as the old useChat() store so callers only need to
 * pick a key.
 *
 * Pass a `null` key during loading states (e.g. waiting on async data) and
 * the hook returns an inert empty thread without persisting noise.
 */
export function useThread(key: string | null) {
  const messages = useChatThreads((s) => (key ? s.threads[key] ?? [] : []));
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

// Backwards-compatible: the old useChat() still works as a single shared
// "free" thread. Used by /dialogue (a freeform global page) until it's
// migrated to a real key.
export function useChat() {
  return useThread("global:free");
}
