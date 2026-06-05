"use client";

/**
 * Shared luxury wizard chrome — the glowing gold stepper + check icon.
 * Used by the multi-step "wizard" screens (add-customer, product editor…)
 * to keep one consistent Gold & Onyx look across the app.
 */

export function CheckIcon({ size = 32 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

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
    <div className="mb-6 flex items-center">
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
  );
}
