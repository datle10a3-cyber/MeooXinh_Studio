"use client";

import { create } from "zustand";
import type { CurrentSession } from "@/app/types/auth";

type UiState = {
  darkMode: boolean;
  activeResource: string;
  session: CurrentSession | null;
  focusedItemId: string | null;
  transactionIntent: "income" | "expense" | null;
  transactionViewIntent: "income" | "expense" | null;
  setDarkMode: (value: boolean) => void;
  setActiveResource: (value: string) => void;
  setSession: (value: CurrentSession | null) => void;
  setFocusedItemId: (value: string | null) => void;
  setTransactionIntent: (value: "income" | "expense" | null) => void;
  setTransactionViewIntent: (value: "income" | "expense" | null) => void;
};

export const useUiStore = create<UiState>((set) => ({
  darkMode: false,
  activeResource: "home",
  session: null,
  focusedItemId: null,
  transactionIntent: null,
  transactionViewIntent: null,
  setDarkMode: (darkMode) => set({ darkMode }),
  setActiveResource: (activeResource) => set({ activeResource }),
  setSession: (session) => set({ session }),
  setFocusedItemId: (focusedItemId) => set({ focusedItemId }),
  setTransactionIntent: (transactionIntent) => set({ transactionIntent }),
  setTransactionViewIntent: (transactionViewIntent) => set({ transactionViewIntent }),
}));
