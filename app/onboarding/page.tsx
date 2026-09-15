import { Suspense } from "react";
import { OnboardingForm } from "./OnboardingForm";

export const metadata = { title: "Unsaid — Tell us about you" };

export default function OnboardingPage() {
  return (
    <div className="container-content py-16">
      <Suspense fallback={null}>
        <OnboardingForm />
      </Suspense>
    </div>
  );
}
