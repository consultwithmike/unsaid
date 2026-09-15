"use client";

import type { QuestionBankEntry } from "@/lib/questions";

type AnswerValue = number | string | string[] | undefined;

export function AnswerInput({
  question,
  value,
  onChange,
}: {
  question: QuestionBankEntry;
  value: AnswerValue;
  onChange: (value: number | string | string[]) => void;
}) {
  if (question.responseType === "MULTI") {
    const selected = Array.isArray(value) ? value : [];
    return (
      <div className="grid gap-3">
        {question.responseOptions.map((opt) => {
          const isSelected = selected.includes(String(opt.value));
          return (
            <button
              type="button"
              key={String(opt.value)}
              onClick={() => {
                const v = String(opt.value);
                const next = isSelected
                  ? selected.filter((s) => s !== v)
                  : [...selected, v];
                onChange(next);
              }}
              className={`press-scale min-h-[52px] rounded-[14px] border px-4 text-left text-[16px] ${
                isSelected
                  ? "border-[var(--color-wine)] bg-[var(--color-stone)]"
                  : "border-[var(--color-warm-gray)] bg-white"
              }`}
              aria-pressed={isSelected}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {question.responseOptions.map((opt) => {
        const isSelected = value === opt.value || String(value) === String(opt.value);
        return (
          <button
            type="button"
            key={String(opt.value)}
            onClick={() => onChange(opt.value)}
            className={`press-scale min-h-[52px] rounded-[14px] border px-4 text-left text-[16px] ${
              isSelected
                ? "border-[var(--color-wine)] bg-[var(--color-stone)]"
                : "border-[var(--color-warm-gray)] bg-white"
            }`}
            aria-pressed={isSelected}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
