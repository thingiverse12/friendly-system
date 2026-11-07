"use client";
import { createContext, useCallback, useContext, useMemo, useRef } from "react";

type FxKind = "correct" | "wrong" | "click" | "win" | "coin" | "spin" | "combo" | "levelup";
const Ctx = createContext<{ play: (k: FxKind) => void; sound: boolean; haptics: boolean }>({ play: () => {}, sound: true, haptics: true });

/** Tiny WebAudio synth – no audio files needed, respects the user's sound/haptics settings. */
export function FxProvider({ children, sound, haptics }: { children: React.ReactNode; sound: boolean; haptics: boolean }) {
  const ctxRef = useRef<AudioContext | null>(null);
  const tone = useCallback((freq: number, dur: number, type: OscillatorType, when = 0, gain = 0.08) => {
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!ctxRef.current) ctxRef.current = new AC();
      const ctx = ctxRef.current;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.value = freq;
      g.gain.setValueAtTime(gain, ctx.currentTime + when);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + when + dur);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + when);
      o.stop(ctx.currentTime + when + dur);
    } catch {}
  }, []);
  const play = useCallback(
    (k: FxKind) => {
      if (haptics && typeof navigator !== "undefined" && navigator.vibrate) {
        if (k === "correct") navigator.vibrate(20);
        else if (k === "wrong") navigator.vibrate([40, 30, 40]);
        else if (k === "win") navigator.vibrate([30, 40, 30, 40, 80]);
        else if (k === "click") navigator.vibrate(8);
        else if (k === "combo") navigator.vibrate([15, 20, 15]);
        else if (k === "levelup") navigator.vibrate([40, 30, 40, 30, 120]);
      }
      if (!sound) return;
      switch (k) {
        case "correct": tone(660, 0.12, "sine"); tone(880, 0.18, "sine", 0.1); break;
        case "wrong": tone(220, 0.25, "sawtooth", 0, 0.05); break;
        case "click": tone(520, 0.05, "square", 0, 0.03); break;
        case "coin": tone(1200, 0.08, "triangle"); tone(1600, 0.12, "triangle", 0.07); break;
        case "spin": for (let i = 0; i < 8; i++) tone(400 + i * 40, 0.05, "square", i * 0.06, 0.025); break;
        case "win": [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.22, "sine", i * 0.11)); break;
        case "combo": [784, 988, 1175].forEach((f, i) => tone(f, 0.1, "triangle", i * 0.06, 0.06)); break;
        case "levelup": [392, 523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.3, "sine", i * 0.09, 0.09)); tone(1568, 0.6, "triangle", 0.55, 0.05); break;
      }
    },
    [sound, haptics, tone]
  );
  const value = useMemo(() => ({ play, sound, haptics }), [play, sound, haptics]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export const useFx = () => useContext(Ctx);
