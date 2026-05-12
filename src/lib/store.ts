"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ChatMessage } from "./types";

interface Settings {
  apiKey: string;
  model: string;
  setApiKey: (k: string) => void;
  setModel: (m: string) => void;
  clearApiKey: () => void;
}

export const useSettings = create<Settings>()(
  persist(
    (set) => ({
      apiKey: "",
      model: "claude-sonnet-4-6",
      setApiKey: (k) => set({ apiKey: k.trim() }),
      setModel: (m) => set({ model: m }),
      clearApiKey: () => set({ apiKey: "" }),
    }),
    { name: "amc-settings" }
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
