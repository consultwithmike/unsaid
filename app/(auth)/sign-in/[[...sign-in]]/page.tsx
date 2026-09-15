import { SignIn } from "@clerk/nextjs";

export const metadata = { title: "Check Unsaid — Sign in" };

export default function SignInPage() {
  return (
    <div className="container-content flex flex-col items-center gap-6 py-16 text-center">
      <h1 className="font-display text-[32px]">Check Unsaid</h1>
      <p className="max-w-[420px] text-[17px] text-[var(--color-ink)]/80">
        Email a one-time code. No password.
      </p>
      <SignIn
        appearance={{
          variables: {
            colorPrimary: "#54263A",
            colorBackground: "#FAF7F2",
            colorText: "#181416",
            fontFamily: "var(--font-body)",
            borderRadius: "14px",
          },
          elements: {
            card: "shadow-none border border-[var(--color-warm-gray)]",
            formButtonPrimary: "bg-[var(--color-wine)] hover:bg-[var(--color-wine-dark)]",
            footerActionLink: "text-[var(--color-wine)]",
          },
        }}
      />
    </div>
  );
}
