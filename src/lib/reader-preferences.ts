"use client";
import { useMemo, useSyncExternalStore } from "react";
import { readerEditions } from "./reader-editions";
import type { EditionDesign } from "./edition-design";

/** Per-device reading preferences, shared by the collection reader and interactive stories. */
export type ReaderPreferences = {
  style: string;
  size: number;
  design: EditionDesign | null;
  plain: boolean;
  showEmojis: boolean;
  fonts: Record<string, string>;
};
const key = "lorekeeper-reader";
const event = "lorekeeper-preferences";
export const readerSizes = [16, 18, 20, 22];
const defaults: ReaderPreferences = { style: "glorious", size: 18, design: null, plain: false, showEmojis: true, fonts: {} };
function read() {
  try {
    return localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}
function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(event, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(event, callback);
  };
}
export function parseReaderPreferences(saved: string): ReaderPreferences {
  try {
    const value = JSON.parse(saved || "{}");
    return {
      style: ["transcript", "monastic", "gothic", "charter"].includes(value.style)
        ? "manuscript"
        : value.style === "pirate"
          ? "captain"
          : readerEditions.some((s) => s.id === value.style)
            ? (value.style as string)
            : defaults.style,
      size: readerSizes.includes(value.size) ? (value.size as number) : defaults.size,
      design: value.design && typeof value.design === "object" ? (value.design as EditionDesign) : null,
      plain: value.plain === true,
      showEmojis: value.showEmojis !== false,
      fonts: value.fonts && typeof value.fonts === "object" ? (value.fonts as Record<string, string>) : {},
    };
  } catch {
    return defaults;
  }
}
export function useReaderPreferences() {
  const saved = useSyncExternalStore(subscribe, read, () => "");
  return useMemo(() => parseReaderPreferences(saved), [saved]);
}
export function saveReaderPreferences(value: ReaderPreferences) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new Event(event));
  } catch {
    /* Preferences still work for this page when storage is disabled. */
  }
}
