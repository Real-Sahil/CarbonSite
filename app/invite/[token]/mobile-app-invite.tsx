"use client";

import { useEffect, useState } from "react";
import { Smartphone, ArrowRight, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MobileAppInviteProps {
  token: string;
  orgName: string;
}

export function MobileAppInvite({ token, orgName }: MobileAppInviteProps) {
  const [appLinkUrl, setAppLinkUrl] = useState<string>("");
  const [opening, setOpening] = useState(false);
  const [showFallback, setShowFallback] = useState(false);

  useEffect(() => {
    const origin = window.location.origin;
    // carbonsite://app/invite/TOKEN?server=https://yourorg.com
    // This is the URL format the Flutter router expects.
    setAppLinkUrl(
      `carbonsite://app/invite/${token}?server=${encodeURIComponent(origin)}`
    );
  }, [token]);

  function handleOpenApp() {
    if (!appLinkUrl) return;
    setOpening(true);

    // Try to open the app via custom scheme. If app is installed it opens
    // immediately. If not, nothing happens — show the fallback after 2.5s.
    window.location.href = appLinkUrl;

    setTimeout(() => {
      setOpening(false);
      setShowFallback(true);
    }, 2500);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Primary CTA */}
      <div className="rounded-2xl border border-green-200 bg-green-50 p-6 flex flex-col items-center gap-4 text-center">
        <div className="h-14 w-14 rounded-2xl bg-green-700 flex items-center justify-center">
          <Smartphone className="h-7 w-7 text-white" />
        </div>
        <div>
          <p className="font-semibold text-green-900 text-lg">
            Open in CarbonSite app
          </p>
          <p className="text-sm text-green-800 mt-1">
            You&apos;ve been invited to join <strong>{orgName}</strong>.
            Tap the button below to open the app and join instantly.
          </p>
        </div>
        <Button
          size="lg"
          className="w-full bg-green-700 hover:bg-green-600 text-white gap-2 h-14 text-base rounded-xl"
          onClick={handleOpenApp}
          disabled={opening || !appLinkUrl}
        >
          {opening ? (
            "Opening app…"
          ) : (
            <>
              Open CarbonSite App
              <ArrowRight className="h-5 w-5" />
            </>
          )}
        </Button>
      </div>

      {/* App not installed — shown after timeout */}
      {showFallback && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 flex flex-col gap-3">
          <p className="text-sm font-medium text-slate-700">
            App not installed?
          </p>
          <p className="text-sm text-slate-500">
            Download the CarbonSite app, then tap{" "}
            <strong>Open CarbonSite App</strong> again.
          </p>
          <a
            href="https://play.google.com/store/apps/details?id=com.carbonsite.mobile"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-green-700 hover:text-green-600 font-medium"
          >
            Download from Google Play
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      )}

      {/* Divider — join on web as secondary path */}
      <div className="flex items-center gap-3">
        <div className="flex-1 border-t border-slate-200" />
        <span className="text-xs text-slate-400">or join on web</span>
        <div className="flex-1 border-t border-slate-200" />
      </div>

      <p className="text-xs text-slate-500 text-center">
        If you manage this organisation,{" "}
        <a
          href="#web-form"
          className="text-green-700 hover:underline"
          onClick={(e) => {
            e.preventDefault();
            window.location.reload();
          }}
        >
          use the web form instead
        </a>
        .
      </p>
    </div>
  );
}
