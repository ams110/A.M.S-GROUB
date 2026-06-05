"use client";

import type { ReactNode } from "react";

/**
 * Gold "review before submit" card used across the wizard screens.
 * <ReviewCard> is the bordered container; <ReviewItem> is one label/value row.
 */

export function ReviewCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-gold/20 bg-gold-50/40 p-4">
      <p className="eyebrow mb-2">{title}</p>
      <dl className="space-y-1.5 text-sm">{children}</dl>
    </div>
  );
}

export function ReviewItem({
  label,
  value,
  mono,
  strong,
}: {
  label: string;
  value: string;
  mono?: boolean;
  /** Render larger/bolder — for the headline total row. */
  strong?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-2 border-b border-gold/10 py-1 last:border-0 ${
        strong ? "text-base" : ""
      }`}
    >
      <dt className={`shrink-0 text-slate-500 ${strong ? "font-bold text-navy-dark" : "text-xs"}`}>
        {label}
      </dt>
      <dd
        className={`truncate ${mono ? "ltr-input" : ""} ${
          strong ? "font-bold text-brand-dark" : "font-medium text-navy-dark"
        }`}
        dir={mono ? "ltr" : undefined}
      >
        {value}
      </dd>
    </div>
  );
}
