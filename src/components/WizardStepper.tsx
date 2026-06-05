"use client";

/**
 * Shared luxury wizard chrome — the glowing gold stepper.
 * Used by the multi-step "wizard" screens (add-customer, product editor,
 * quotes, purchase-orders, checkout…) to keep one consistent Gold & Onyx look.
 */

import { CheckIcon } from "./icons";

// Re-export so existing importers can keep getting CheckIcon from here.
export { CheckIcon } from "./icons";

export function WizardStepper({
  steps,
  current,
  onStepClick,
}: {
  steps: string[];
  current: number;
  /** When provided, steps become clickable (e.g. edit mode where all data is loaded). */
  onStepClick?: (i: number) => void;
}) {
  return (
    <div className="mb-6">
      <div className="flex items-center">
        {steps.map((label, i) => {
          const clickable = !!onStepClick;
          return (
            <div key={label} className="flex flex-1 items-center last:flex-none">
              <button
                type="button"
                onClick={clickable ? () => onStepClick!(i) : undefined}
                disabled={!clickable}
                className={`flex flex-col items-center ${clickable ? "cursor-pointer" : "cursor-default"}`}
              >
                <div
                  className={`grid h-10 w-10 place-items-center rounded-full text-sm font-bold transition-all duration-300 ${
                    i < current
                      ? "bg-gold/85 text-navy-dark"
                      : i === current
                      ? "animate-gold-pulse bg-gold-gradient text-navy-dark ring-2 ring-gold/40"
                      : "border border-white/12 bg-white/[0.06] text-slate-400"
                  }`}
                >
                  {i < current ? <CheckIcon size={14} /> : i + 1}
                </div>
                <span
                  className={`mt-1.5 text-[11px] transition-colors ${
                    i === current ? "font-semibold text-brand" : "text-slate-400"
                  }`}
                >
                  {label}
                </span>
              </button>
              {i < steps.length - 1 && (
                <div className="mx-1 h-1 flex-1 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-gold-gradient transition-all duration-500"
                    style={{ width: i < current ? "100%" : "0%" }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Mobile progress readout — quick "where am I" on small screens */}
      <div className="mt-3 sm:hidden">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-brand">{steps[current]}</span>
          <span className="text-slate-400">
            שלב {current + 1} מתוך {steps.length}
          </span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gold-gradient transition-all duration-500"
            style={{ width: `${((current + 1) / steps.length) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}
