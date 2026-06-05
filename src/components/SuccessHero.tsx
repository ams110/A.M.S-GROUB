"use client";

import type { ReactNode } from "react";
import { CheckIcon } from "./icons";

/**
 * Gold success hero — the celebratory header for wizard "done" screens.
 * Gradient gold band, soft light flares, a popping checkmark in a glowing ring,
 * then a title + optional subtitle. Place it as the top band of a `.card`.
 */
export function SuccessHero({ title, subtitle }: { title: string; subtitle?: ReactNode }) {
  return (
    <div className="relative overflow-hidden bg-gold-gradient px-6 py-9 text-center text-navy-dark">
      <div className="pointer-events-none absolute inset-0 opacity-20 [background:radial-gradient(120px_60px_at_20%_0%,#fff,transparent),radial-gradient(160px_80px_at_90%_120%,#fff,transparent)]" />
      <div className="animate-pop-in mx-auto mb-3 grid h-20 w-20 place-items-center rounded-full bg-navy-dark/10 text-4xl shadow-gold ring-4 ring-white/30">
        <CheckIcon />
      </div>
      <h2 className="text-2xl font-extrabold tracking-tight">{title}</h2>
      {subtitle && <p className="mt-1 text-sm font-medium text-navy-dark/75">{subtitle}</p>}
    </div>
  );
}
