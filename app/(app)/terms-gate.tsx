import { AcceptTermsForm } from "@/app/accept-terms/accept-terms-form";
import { TERMS_VERSION } from "@/lib/legal/terms";

/** Shown in place of the app until the signed-in person accepts the current Terms. */
export function TermsGate() {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-6 px-6 py-12">
      <div>
        <h1 className="text-xl font-semibold text-[#111827]">Accept the Terms of Service</h1>
        <p className="mt-2 text-sm text-[#374151]">
          Before you use MetricOra, please read and accept the Terms of Service (version {TERMS_VERSION}) and the Privacy Policy.
          Your organisation&apos;s administrator may have added you without you signing up, so this step is needed once.
        </p>
      </div>
      <AcceptTermsForm />
    </main>
  );
}
