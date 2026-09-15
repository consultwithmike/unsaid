import { LinkButton } from "@/components/ui/Button";
import { LEGAL_PARAGRAPH } from "@/lib/copy";

const PROBLEM_ITEMS = [
  "Children",
  "Money",
  "Sex",
  "Faith",
  "Family",
  "Careers",
  "Where you'll live",
  "What marriage actually means",
];

const HOW_IT_WORKS = [
  { title: "Answer privately.", body: "You each complete the same questions independently." },
  { title: "Unsaid compares.", body: "Your individual answers remain private." },
  { title: "See the gaps.", body: "Unsaid identifies where expectations meaningfully differ." },
  {
    title: "Talk before you wed.",
    body: "Because discovering it now beats discovering it five years from now.",
  },
];

const PRIVACY_LINES = [
  "Your answers belong to you.",
  "Your partner cannot browse your responses.",
  "Unsaid reveals differences—not private answers.",
  "Exact answers are only revealed when you both choose to reveal them.",
];

export default function Home() {
  return (
    <>
      {/* One composition hero — brand-first, full-bleed ivory atmosphere. */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(120% 90% at 50% -10%, rgba(184,102,122,0.16), transparent 60%), radial-gradient(80% 60% at 100% 0%, rgba(84,38,58,0.08), transparent 60%)",
          }}
        />
        <div className="container-content flex flex-col items-center gap-6 py-20 text-center sm:py-28">
          <p className="fade-rise font-display text-[22px] text-[var(--color-wine)]">
            Unsaid
          </p>
          <h1 className="fade-rise font-display text-[42px] leading-[1.05] sm:text-[50px]">
            Before you wed.
            <br />
            Check Unsaid.
          </h1>
          <p className="fade-rise max-w-[560px] text-[18px] leading-[1.5] text-[var(--color-ink)]/80">
            Privately answer the questions couples often avoid. Unsaid compares what
            both of you actually expect from marriage and finds the differences worth
            talking about—before they become surprises.
          </p>
          <div className="fade-rise flex flex-col items-center gap-3 sm:flex-row">
            <LinkButton href="/checks/new" variant="primary">
              Start your check
            </LinkButton>
            <LinkButton href="#how-it-works" variant="secondary">
              See how it works
            </LinkButton>
          </div>
          <p className="fade-rise text-sm text-[var(--color-ink)]/60">
            $29 per couple · No subscription
          </p>
        </div>
      </section>

      {/* Problem */}
      <section className="border-t border-[var(--color-warm-gray)] bg-[var(--color-stone)]/60 py-16">
        <div className="container-content text-center">
          <h2 className="font-display text-[28px]">
            Love doesn&rsquo;t automatically answer the hard questions.
          </h2>
          <ul className="mx-auto mt-6 flex max-w-[520px] flex-wrap justify-center gap-3 text-[15px] text-[var(--color-ink)]/80">
            {PROBLEM_ITEMS.map((item) => (
              <li
                key={item}
                className="rounded-full border border-[var(--color-warm-gray)] bg-[var(--color-white)] px-4 py-2"
              >
                {item}
              </li>
            ))}
          </ul>
          <p className="mx-auto mt-8 max-w-[560px] text-[17px] text-[var(--color-ink)]/80">
            You may love each other deeply and still be assuming completely different
            futures.
          </p>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-16">
        <div className="container-content">
          <h2 className="text-center font-display text-[28px]">How it works</h2>
          <ol className="mx-auto mt-10 grid max-w-[560px] gap-8">
            {HOW_IT_WORKS.map((step, i) => (
              <li key={step.title} className="flex gap-4">
                <span className="font-display text-[24px] text-[var(--color-rose)]">
                  {i + 1}
                </span>
                <div>
                  <p className="font-semibold">{step.title}</p>
                  <p className="text-[var(--color-ink)]/75">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Privacy block */}
      <section className="border-y border-[var(--color-warm-gray)] bg-[var(--color-stone)]/60 py-16">
        <div className="container-content max-w-[520px] text-center">
          <ul className="grid gap-3 text-[17px]">
            {PRIVACY_LINES.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20">
        <div className="container-content flex flex-col items-center gap-4 text-center">
          <p className="max-w-[440px] text-[19px]">
            You don&rsquo;t need to agree on everything.
            <br />
            You should know what you&rsquo;re disagreeing about.
          </p>
          <p className="font-display text-[24px] text-[var(--color-wine)]">
            Before you wed. Check Unsaid.
          </p>
          <LinkButton href="/checks/new" variant="primary">
            Start your check
          </LinkButton>
        </div>
      </section>

      <p className="container-content mx-auto max-w-[640px] pb-16 text-center text-xs text-[var(--color-ink)]/50">
        {LEGAL_PARAGRAPH}
      </p>
    </>
  );
}
