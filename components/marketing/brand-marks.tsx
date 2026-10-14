import { cn } from "@/lib/utils";

export const PLAY_URL = "https://play.google.com/store/apps/details?id=app.metricora.metricora_mobile";
export const APP_STORE_URL = "https://apps.apple.com/gb/app/metricora/id6811462209";

// Glyphs from Simple Icons (CC0; apple.svg from v13.21.0). Apple, Google Play
// and Stripe are trademarks of their owners and are used here only to point to
// the listing and name the payment processor.
const APPLE_PATH =
  "M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701";
const PLAY_PATH =
  "M22.018 13.298l-3.919 2.218-3.515-3.493 3.543-3.521 3.891 2.202a1.49 1.49 0 0 1 0 2.594zM1.337.924a1.486 1.486 0 0 0-.112.568v21.017c0 .217.045.419.124.6l11.155-11.087L1.337.924zm12.207 10.065l3.258-3.238L3.45.195a1.466 1.466 0 0 0-.946-.179l11.04 10.973zm0 2.067l-11 10.933c.298.036.612-.016.906-.183l13.324-7.54-3.23-3.21z";
const STRIPE_PATH =
  "M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.594-7.305h.003z";

function StoreBadge({
  href,
  label,
  caption,
  store,
  path,
  className,
}: {
  href: string;
  label: string;
  caption: string;
  store: string;
  path: string;
  className?: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className={cn(
        "inline-flex h-12 items-center gap-3 rounded-[10px] border border-white/25 bg-black px-4 text-white transition-colors hover:border-white/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mk-accent-lit",
        className,
      )}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6" fill="currentColor">
        <path d={path} />
      </svg>
      <span className="flex flex-col leading-none">
        <span className="text-[10px] uppercase tracking-[0.06em]">{caption}</span>
        <span className="mt-0.5 text-[18px] font-medium tracking-[-0.01em]">{store}</span>
      </span>
    </a>
  );
}

/// "Get it on Google Play" badge linking to the MetricOra listing.
export function GooglePlayBadge({ className }: { className?: string }) {
  return (
    <StoreBadge
      href={PLAY_URL}
      label="Get it on Google Play: MetricOra field app"
      caption="Get it on"
      store="Google Play"
      path={PLAY_PATH}
      className={className}
    />
  );
}

/// "Download on the App Store" badge linking to the MetricOra iPhone listing.
export function AppStoreBadge({ className }: { className?: string }) {
  return (
    <StoreBadge
      href={APP_STORE_URL}
      label="Download on the App Store: MetricOra field app"
      caption="Download on the"
      store="App Store"
      path={APPLE_PATH}
      className={className}
    />
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
