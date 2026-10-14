"use client";
import { createContext, type ReactNode } from "react";
export const StoryInteractions = createContext<
  ((key: string) => ReactNode) | null
>(null);
