"use client";

import type { ReactNode } from "react";
import { CheckIcon } from "./icons";

/**
 * Selectable glass "choice" card (Gold & Onyx) — the pick-one-of-N tile used in
 * wizard steps (e.g. customer type). Glassy dark surface, glowing gold border +
 * checkmark badge when active, gentle float on hover.
 */
export function ChoiceCard({
  active,
  onClick,
  icon,
  title,
  description,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  title: string;
  description?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative rounded-2xl border p-5 text-center backdrop-blur transition-all duration-200 hover:-translate-y-0.5 ${
        active
          ? "border-gold bg-gold-50 shadow-gold ring-1 ring-gold/40"
          : "border-white/10 bg-white/[0.04] hover:border-gold/40 hover:bg-gold-50/40"
      }`}
    >
      {active && (
        <span className="animate-pop-in absolute right-3 top-3 grid h-6 w-6 place-items-center rounded-full bg-gold-gradient text-navy-dark shadow-gold">
          <CheckIcon size={14} />
        </span>
      )}
      <div
        className={`mx-auto grid h-14 w-14 place-items-center rounded-2xl transition-colors ${
          active ? "text-gold-dark" : "text-slate-400 group-hover:text-gold-dark"
        }`}
      >
        {icon}
      </div>
      <div className="mt-2 font-bold text-navy-dark">{title}</div>
      {description && <div className="mt-1 text-xs text-slate-500">{description}</div>}
    </button>
  );
}
