"use client";

import { useBackground, BG_OPTIONS, type BgKey } from "@/components/BackgroundProvider";

const PREVIEW: Record<BgKey, string> = {
  "onyx-aurora":
    "radial-gradient(circle at 25% 20%, rgba(230,194,78,.5), transparent 45%), radial-gradient(circle at 80% 75%, rgba(201,162,39,.35), transparent 50%), #0A0908",
  "onyx-gold":
    "radial-gradient(circle at 15% 0%, rgba(201,162,39,.55), transparent 60%), linear-gradient(160deg,#1C1A17,#0C0B0A)",
  mesh:
    "radial-gradient(circle at 18% 18%, rgba(201,162,39,.8), transparent 55%), radial-gradient(circle at 85% 20%, rgba(224,120,60,.7), transparent 55%), radial-gradient(circle at 80% 85%, rgba(124,45,58,.7), transparent 55%), #FBF6EA",
  "light-gold":
    "radial-gradient(circle at 12% 8%, rgba(201,162,39,.5), transparent 60%), linear-gradient(180deg,#FBF7EE,#F4EEE0)",
};

export default function BackgroundSwitcher() {
  const { bg, setBg } = useBackground();

  return (
    <section className="card p-6">
      <h3 className="font-bold text-navy-dark">מראה הרקע</h3>
      <p className="mb-4 mt-0.5 text-xs text-slate-400">בחרו את רקע האפליקציה · נשמר במכשיר זה</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {BG_OPTIONS.map((o) => {
          const active = bg === o.key;
          return (
            <button
              key={o.key}
              onClick={() => setBg(o.key)}
              className={`group overflow-hidden rounded-2xl border text-right transition ${
                active ? "border-gold ring-2 ring-gold/40" : "border-navy/10 hover:border-gold/40"
              }`}
            >
              <span className="block h-16 w-full" style={{ background: PREVIEW[o.key] }} />
              <span className="flex items-center justify-between gap-1 bg-white px-2.5 py-2">
                <span className="truncate text-xs font-semibold text-navy-dark">{o.label}</span>
                {active && <span className="text-xs text-gold-dark">✓</span>}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
