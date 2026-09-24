import { cn } from "@/lib/utils";

export const PLAY_URL = "https://play.google.com/store/apps/details?id=app.metricora.metricora_mobile";

// Glyphs from Simple Icons (CC0). Google Play and Stripe are trademarks of
// their owners and are used here only to point to the listing and name the
// payment processor.
const PLAY_PATH =
  "M22.018 13.298l-3.919 2.218-3.515-3.493 3.543-3.521 3.891 2.202a1.49 1.49 0 0 1 0 2.594zM1.337.924a1.486 1.486 0 0 0-.112.568v21.017c0 .217.045.419.124.6l11.155-11.087L1.337.924zm12.207 10.065l3.258-3.238L3.45.195a1.466 1.466 0 0 0-.946-.179l11.04 10.973zm0 2.067l-11 10.933c.298.036.612-.016.906-.183l13.324-7.54-3.23-3.21z";
const STRIPE_PATH =
  "M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.594-7.305h.003z";

/// "Get it on Google Play" badge linking to the MetricOra listing.
export function GooglePlayBadge({ className }: { className?: string }) {
  return (
    <a
      href={PLAY_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Get it on Google Play: MetricOra field app"
      className={cn(
        "inline-flex h-12 items-center gap-3 rounded-[10px] border border-white/25 bg-black px-4 text-white transition-colors hover:border-white/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mk-accent-lit",
        className,
      )}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6" fill="currentColor">
        <path d={PLAY_PATH} />
      </svg>
      <span className="flex flex-col leading-none">
        <span className="text-[10px] uppercase tracking-[0.06em]">Get it on</span>
        <span className="mt-0.5 text-[18px] font-medium tracking-[-0.01em]">Google Play</span>
      </span>
    </a>
  );
}

/// Stripe mark with a short line saying payments go through Stripe.
export function StripeNote({ className, tone = "light" }: { className?: string; tone?: "light" | "dark" }) {
  return (
    <p className={cn("inline-flex items-center gap-2 text-[13px]", tone === "dark" ? "text-mk-on-dark-2" : "text-mk-text-3", className)}>
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 text-[#635BFF]" fill="currentColor">
        <path d={STRIPE_PATH} />
      </svg>
      Payments processed securely by Stripe
    </p>
  );
}
