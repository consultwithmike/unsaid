"use client";

import { HARD_LINE_QUESTION, HARD_LINE_TOGGLE, IMPORTANCE_LABELS } from "@/lib/copy";

export function ImportanceHardLine({
  importance,
  hardLine,
  onImportanceChange,
  onHardLineChange,
}: {
  importance: number | undefined;
  hardLine: boolean;
  onImportanceChange: (n: number) => void;
  onHardLineChange: (b: boolean) => void;
}) {
  const showHardLine = (importance ?? 0) >= 4;

  return (
    <div className="mt-8 border-t border-[var(--color-warm-gray)] pt-6">
      <p className="text-sm font-medium">How much does this matter to you?</p>
      <div className="mt-3 grid grid-cols-5 gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            type="button"
            key={n}
            onClick={() => onImportanceChange(n)}
            aria-pressed={importance === n}
            className={`press-scale flex min-h-[52px] flex-col items-center justify-center rounded-[14px] border text-xs font-medium ${
              importance === n
                ? "border-[var(--color-wine)] bg-[var(--color-stone)]"
                : "border-[var(--color-warm-gray)] bg-white"
            }`}
          >
            <span className="text-[16px] font-semibold">{n}</span>
            <span className="hidden sm:inline">{IMPORTANCE_LABELS[n]}</span>
          </button>
        ))}
      </div>

      {showHardLine && (
        <div className="mt-5 rounded-[14px] bg-[var(--color-stone)] p-4">
          <p className="text-sm">{HARD_LINE_QUESTION}</p>
          <label className="mt-3 flex items-center gap-3 text-[15px]">
            <input
              type="checkbox"
              checked={hardLine}
              onChange={(e) => onHardLineChange(e.target.checked)}
              className="h-5 w-5 accent-[var(--color-wine)]"
            />
            {HARD_LINE_TOGGLE}
          </label>
        </div>
      )}
    </div>
  );
}
