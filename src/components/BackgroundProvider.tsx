"use client";

import { createContext, useContext, useEffect, useState } from "react";
import Aurora from "@/components/Aurora";

export type BgKey = "onyx-aurora" | "onyx-gold" | "mesh" | "light-gold";

export const BG_OPTIONS: { key: BgKey; label: string; dark: boolean }[] = [
  { key: "onyx-aurora", label: "אוניקס · זהב חי", dark: true },
  { key: "onyx-gold", label: "מעבר זהב כהה", dark: true },
  { key: "mesh", label: "צבעוני חי", dark: false },
  { key: "light-gold", label: "זהב בהיר", dark: false },
];

const STORAGE_KEY = "ams_bg";
const DEFAULT: BgKey = "onyx-aurora";

const Ctx = createContext<{ bg: BgKey; setBg: (b: BgKey) => void }>({
  bg: DEFAULT,
  setBg: () => {},
});

export const useBackground = () => useContext(Ctx);

export default function BackgroundProvider({ children }: { children: React.ReactNode }) {
  const [bg, setBgState] = useState<BgKey>(DEFAULT);

  // Load saved preference
  useEffect(() => {
    const saved = (typeof window !== "undefined" && localStorage.getItem(STORAGE_KEY)) as BgKey | null;
    const valid = saved && BG_OPTIONS.some((o) => o.key === saved) ? saved : DEFAULT;
    setBgState(valid);
  }, []);

  // Reflect on <html data-bg>
  useEffect(() => {
    document.documentElement.dataset.bg = bg;
  }, [bg]);

  const setBg = (b: BgKey) => {
    setBgState(b);
    try {
      localStorage.setItem(STORAGE_KEY, b);
    } catch {}
  };

  return (
    <Ctx.Provider value={{ bg, setBg }}>
      {/* Fixed living backdrop for the aurora theme */}
      {bg === "onyx-aurora" && (
        <div className="pointer-events-none fixed inset-0 -z-10 print:hidden">
          <Aurora />
        </div>
      )}
      {children}
    </Ctx.Provider>
  );
}
