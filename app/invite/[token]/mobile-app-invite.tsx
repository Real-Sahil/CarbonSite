"use client";

import { useEffect, useState } from "react";
import { Smartphone, ArrowRight, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { APP_STORE_URL } from "@/components/marketing/brand-marks";

interface MobileAppInviteProps {
  token: string;
  orgName: string;
  /** No web form to fall back to (the store reviewers' demo link). */
  appOnly?: boolean;
}

export function MobileAppInvite({ token, orgName, appOnly = false }: MobileAppInviteProps) {
  const [opening, setOpening] = useState(false);
  const [showFallback, setShowFallback] = useState(false);
  const [android, setAndroid] = useState(false);
  const [ios, setIos] = useState(false);

  // Auto-attempt to open the app on mount for a true magic-link experience.
  // The page stays visible as a fallback while the OS tries to hand off.
  useEffect(() => {
    const ua = navigator.userAgent;
    // A Mac agent without a touch screen is a real Mac, not an iPad in
    // desktop mode: it has no app, so show the web form.
    if (!appOnly && /Macintosh/.test(ua) && navigator.maxTouchPoints === 0) {
      window.location.replace("?webform=1");
      return;
    }
    setAndroid(/android/i.test(ua));
    setIos(/iPhone|iPad|iPod/.test(ua));
    const url = `metricora://app/invite/${token}?server=${encodeURIComponent(window.location.origin)}`;
    setOpening(true);
    window.location.href = url;
    const t = setTimeout(() => {
      setOpening(false);
      setShowFallback(true);
    }, 2500);
    return () => clearTimeout(t);
  }, [token, appOnly]);

  function handleOpenApp() {
    const url = `metricora://app/invite/${token}?server=${encodeURIComponent(window.location.origin)}`;
    setOpening(true);
    setShowFallback(false);
    window.location.href = url;
    setTimeout(() => {
      setOpening(false);
      setShowFallback(true);
    }, 2500);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Primary CTA */}
      <div className="rounded-2xl border border-[#E3E8EE] bg-[#F9FAFC] p-6 flex flex-col items-center gap-4 text-center">
        <div className="h-14 w-14 rounded-2xl bg-[#c2400c] flex items-center justify-center">
          <Smartphone className="h-7 w-7 text-white" />
        </div>
        <div>
          <p className="font-semibold text-[#131d29] text-lg">
            {opening ? "Opening MetricOra app…" : "Open in MetricOra app"}
          </p>
          <p className="text-sm text-[#131d29] mt-1">
            You&apos;ve been invited to join <strong>{orgName}</strong>.
            {opening
              ? " If the app doesn't open, tap the button below."
              : " Tap the button below to open the app and join instantly."}
          </p>
        </div>
        <Button
          size="lg"
          className="w-full gap-2 h-14 text-base"
          onClick={handleOpenApp}
          disabled={opening}
        >
          {opening ? (
            "Opening app…"
          ) : (
            <>
              Open MetricOra App
              <ArrowRight className="h-5 w-5" />
            </>
          )}
        </Button>
      </div>

      {/* App not installed — shown after timeout */}
      {showFallback && (
        <div className="rounded-xl border border-[#E3E8EE] bg-white p-5 flex flex-col gap-3">
          <p className="text-sm font-medium text-[#41505F]">
            App not installed?
          </p>
          <p className="text-sm text-[#5B6A78]">
            Install the MetricOra app on this device, then tap{" "}
            <strong>Open MetricOra App</strong> again.
          </p>
          {android && (
            <a
              href={
                process.env.NEXT_PUBLIC_MOBILE_INSTALL_URL ??
                "https://play.google.com/store/apps/details?id=app.metricora.metricora_mobile"
              }
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-[#c2400c] hover:text-[#a33409] font-medium"
            >
              Get the MetricOra app on Google Play
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
          {ios && (
            <a
              href={APP_STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-[#c2400c] hover:text-[#a33409] font-medium"
            >
              Get the MetricOra app on the App Store
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      )}

      {!appOnly && (
      <>
      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="flex-1 border-t border-[#E3E8EE]" />
        <span className="text-xs text-[#5B6A78]">or join on web</span>
        <div className="flex-1 border-t border-[#E3E8EE]" />
      </div>

      <p className="text-xs text-[#5B6A78] text-center">
        If you manage this organisation,{" "}
        <a
          href="?webform=1"
          className="text-[#c2400c] hover:underline"
        >
          use the web form instead
        </a>
        .
      </p>
      </>
      )}
    </div>
  );
}
