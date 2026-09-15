import { LinkButton } from "@/components/ui/Button";

export function SeoStub({ h1 }: { h1: string }) {
  return (
    <div className="container-content flex flex-col items-center gap-6 py-20 text-center">
      <h1 className="max-w-[560px] font-display text-[32px]">{h1}</h1>
      <p className="max-w-[480px] text-[var(--color-ink)]/70">
        You don&rsquo;t have to agree on everything before marriage. You should know
        what you&rsquo;re disagreeing about.
      </p>
      <p className="font-display text-[20px] text-[var(--color-wine)]">
        Before you wed. Check Unsaid.
      </p>
      <LinkButton href="/sign-in">Start your check</LinkButton>
    </div>
  );
}
