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

interface ChatState {
  messages: ChatMessage[];
  isStreaming: boolean;
  append: (m: ChatMessage) => void;
  setLastContent: (content: string, citations?: ChatMessage["citations"]) => void;
  setStreaming: (v: boolean) => void;
  reset: () => void;
}

export const useChat = create<ChatState>((set) => ({
  messages: [],
  isStreaming: false,
  append: (m) => set((s) => ({ messages: [...s.messages, m] })),
  setLastContent: (content, citations) =>
    set((s) => {
      const idx = s.messages.length - 1;
      if (idx < 0) return s;
      const updated = [...s.messages];
      updated[idx] = { ...updated[idx], content, citations: citations ?? updated[idx].citations };
      return { messages: updated };
    }),
  setStreaming: (v) => set({ isStreaming: v }),
  reset: () => set({ messages: [] }),
}));
