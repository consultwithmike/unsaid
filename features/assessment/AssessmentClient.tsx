"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { OfflineBanner } from "@/components/ui/OfflineBanner";
import { apiGet, apiPost } from "@/lib/api-client";
import { getSectionById } from "@/lib/question-bank";
import {
  enqueuePendingResponse,
  flushPendingResponses,
  getAllPendingResponses,
} from "@/lib/offline-queue";
import type { ResponsesResumeResponse, SubmitResponseRequest } from "@/lib/types";
import { AnswerInput } from "./AnswerInput";
import { ImportanceHardLine } from "./ImportanceHardLine";
import { buildSteps, findStepIndexForCode, type AnswerState } from "./steps";

export function AssessmentClient({ checkId }: { checkId: string }) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, AnswerState>>({});
  const [stepIndex, setStepIndex] = useState(0);
  const [ready, setReady] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [queueSize, setQueueSize] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [blockedOffline, setBlockedOffline] = useState(false);
  const pushedInitial = useRef(false);

  const steps = useMemo(() => buildSteps(answers), [answers]);
  const step = steps[Math.min(stepIndex, steps.length - 1)];

  // Hydrate from resume cursor.
  useEffect(() => {
    (async () => {
      const result = await apiGet<ResponsesResumeResponse>(
        `/api/responses?checkId=${checkId}`,
      );
      if (result.ok) {
        const hydrated: Record<string, AnswerState> = {};
        for (const a of result.data.answers) {
          hydrated[a.code] = {
            answer: a.answer,
            importance: a.importance,
            hardLine: a.hardLine,
          };
        }
        setAnswers(hydrated);
        const initialSteps = buildSteps(hydrated);
        setStepIndex(findStepIndexForCode(initialSteps, result.data.currentQuestionCode));
      }
      setReady(true);
    })();
  }, [checkId]);

  // Offline detection + queue size.
  useEffect(() => {
    setIsOnline(navigator.onLine);
    const onOnline = () => {
      setIsOnline(true);
      void flushQueue();
    };
    const onOffline = () => setIsOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshQueueSize = useCallback(async () => {
    const pending = await getAllPendingResponses(checkId);
    setQueueSize(pending.length);
  }, [checkId]);

  useEffect(() => {
    void refreshQueueSize();
  }, [refreshQueueSize]);

  async function submitAnswer(req: SubmitResponseRequest): Promise<boolean> {
    const result = await apiPost("/api/responses", req);
    return result.ok;
  }

  async function flushQueue() {
    await flushPendingResponses(checkId, async (entry) =>
      submitAnswer({
        checkId: entry.checkId,
        questionCode: entry.questionCode,
        answer: entry.answer,
        importance: entry.importance,
        hardLine: entry.hardLine,
      }),
    );
    await refreshQueueSize();
  }

  // Browser back support.
  useEffect(() => {
    if (!pushedInitial.current) {
      window.history.replaceState({ step: stepIndex }, "");
      pushedInitial.current = true;
    }
    const onPop = (e: PopStateEvent) => {
      const s = (e.state as { step?: number } | null)?.step;
      if (typeof s === "number") setStepIndex(s);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function advanceTo(nextIndex: number) {
    window.history.pushState({ step: nextIndex }, "");
    setStepIndex(nextIndex);
  }

  if (!ready || !step) {
    return <div className="container-content py-20 text-center text-[var(--color-ink)]/50">Loading…</div>;
  }

  const showOfflineBanner = !isOnline || queueSize > 0;

  if (step.kind === "intro") {
    const section = getSectionById(step.sectionId);
    if (!section) return null;
    return (
      <div className="flex min-h-[70vh] flex-col">
        {showOfflineBanner && <OfflineBanner />}
        <div className="container-content flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <h1 className="font-display text-[28px]">{section.title}</h1>
          <p className="max-w-[440px] text-[17px] text-[var(--color-ink)]/75">
            {section.intro}
          </p>
          <p className="text-sm text-[var(--color-ink)]/50">{section.durationHint}</p>
        </div>
        <StickyCta onClick={() => advanceTo(stepIndex + 1)}>Continue</StickyCta>
      </div>
    );
  }

  if (step.kind === "sectionComplete") {
    const section = getSectionById(step.sectionId);
    const nextSection = step.nextSectionId ? getSectionById(step.nextSectionId) : null;
    const isLast = !step.nextSectionId;

    return (
      <div className="flex min-h-[70vh] flex-col">
        {showOfflineBanner && <OfflineBanner />}
        <div className="container-content flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <h1 className="font-display text-[28px]">{section?.title} done.</h1>
          <p className="text-[var(--color-ink)]/75">
            Your answers have been saved privately.
          </p>
          {blockedOffline && (
            <p className="text-sm text-[var(--color-brick)]">
              You&rsquo;re offline. We&rsquo;ll finish saving your answers automatically
              when your connection returns.
            </p>
          )}
        </div>
        <StickyCta
          disabled={submitting}
          onClick={async () => {
            if (!isLast) {
              advanceTo(stepIndex + 1);
              return;
            }
            setSubmitting(true);
            await flushQueue();
            const pending = await getAllPendingResponses(checkId);
            if (pending.length > 0) {
              setBlockedOffline(true);
              setSubmitting(false);
              return;
            }
            const result = await apiPost("/api/assessment/complete", { checkId });
            setSubmitting(false);
            if (result.ok || result.error.code === "NOT_IMPLEMENTED") {
              router.push(`/checks/${checkId}/ready`);
            }
          }}
        >
          {isLast ? "Finish" : `Continue to ${nextSection?.title ?? ""}`}
        </StickyCta>
      </div>
    );
  }

  // step.kind === "question"
  const { question, sectionId, indexInSection, sectionSize } = step;
  const section = getSectionById(sectionId);
  const current = answers[question.code];
  const canContinue =
    current?.answer !== undefined &&
    !(Array.isArray(current.answer) && current.answer.length === 0) &&
    current?.importance !== undefined;

  return (
    <div className="flex min-h-[70vh] flex-col">
      {showOfflineBanner && <OfflineBanner />}
      <div className="container-content flex-1 py-8">
        <p className="text-sm font-medium text-[var(--color-rose)]">
          {section?.title} · {indexInSection} of {sectionSize}
        </p>
        <h1 className="mt-3 font-display text-[26px] leading-snug">{question.text}</h1>

        <div className="mt-6">
          <AnswerInput
            question={question}
            value={current?.answer}
            onChange={(value) =>
              setAnswers((prev) => ({
                ...prev,
                [question.code]: {
                  answer: value,
                  importance: prev[question.code]?.importance ?? 0,
                  hardLine: prev[question.code]?.hardLine ?? false,
                },
              }))
            }
          />
        </div>

        <ImportanceHardLine
          importance={current?.importance}
          hardLine={current?.hardLine ?? false}
          onImportanceChange={(n) =>
            setAnswers((prev) => ({
              ...prev,
              [question.code]: {
                answer: prev[question.code]?.answer ?? ("" as never),
                importance: n,
                hardLine: prev[question.code]?.hardLine ?? false,
              },
            }))
          }
          onHardLineChange={(b) =>
            setAnswers((prev) => ({
              ...prev,
              [question.code]: {
                answer: prev[question.code]?.answer ?? ("" as never),
                importance: prev[question.code]?.importance ?? 0,
                hardLine: b,
              },
            }))
          }
        />
      </div>

      <StickyCta
        disabled={!canContinue || submitting}
        onClick={async () => {
          if (!current) return;
          setSubmitting(true);
          const req: SubmitResponseRequest = {
            checkId,
            questionCode: question.code,
            answer: current.answer,
            importance: current.importance,
            hardLine: current.hardLine,
          };
          if (!navigator.onLine) {
            await enqueuePendingResponse(req);
            await refreshQueueSize();
          } else {
            const success = await submitAnswer(req);
            if (!success) {
              await enqueuePendingResponse(req);
              await refreshQueueSize();
            }
          }
          setSubmitting(false);
          advanceTo(stepIndex + 1);
        }}
      >
        Continue
      </StickyCta>
    </div>
  );
}

function StickyCta({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="sticky bottom-0 border-t border-[var(--color-warm-gray)] bg-[var(--color-ivory)]/95 py-4 backdrop-blur">
      <div className="container-content">
        <Button onClick={onClick} disabled={disabled} fullWidth>
          {children}
        </Button>
      </div>
    </div>
  );
}
