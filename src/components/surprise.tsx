"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "./icon";
// "Surprise me": a light runs over the cards, slows down and lands on the chosen one.
// The same spin replays for everyone watching, so the result is decided up front.
export function useSpin() {
  const [lit, setLit] = useState<string | null>(null),
    [fated, setFated] = useState<string | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const clear = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  useEffect(() => clear, []);
  const spin = useCallback((ids: string[], target: string) => {
    clear();
    const end = ids.indexOf(target);
    const land = () => {
      setLit(null);
      setFated(target);
      timers.current.push(setTimeout(() => setFated(null), 1600));
    };
    if (end < 0 || ids.length < 2 || matchMedia("(prefers-reduced-motion: reduce)").matches)
      return land();
    // Two to three laps, each step a little slower, ending exactly on the target.
    const steps = ids.length * 2 + 6 + Math.floor(Math.random() * ids.length);
    let at = 0;
    for (let k = 0; k < steps; k++) {
      const id = ids[(((end - (steps - 1 - k)) % ids.length) + ids.length) % ids.length];
      at += 55 + 420 * (k / steps) ** 3;
      timers.current.push(setTimeout(() => setLit(id), at));
    }
    timers.current.push(setTimeout(land, at + 450));
  }, []);
  return { lit, fated, spinning: lit !== null, spin };
}
// The spin state of one card, for its data attributes.
export const spinState = (s: { lit: string | null; fated: string | null }, id: string) => ({
  "data-lit": s.lit === id || undefined,
  "data-fated": s.fated === id || undefined,
});
export function SurpriseButton({
  onClick,
  disabled,
}: {
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button type="button" className="lkx-surprise" onClick={onClick} disabled={disabled}>
      <Icon name="shuffle" /> Surprise me
    </button>
  );
}
