"use client";

import { useEffect } from "react";
import { EARTHY_COOKIE } from "@/lib/dashboard/earthy-flag";

/**
 * Keeps an admin's `?earthy=1` / `?earthy=0` choice for the rest of the visit. Server components cannot set
 * cookies, and the org layout (which wraps the sidebar) cannot see search params, so the dashboard page
 * renders this and the browser stores the choice. The cookie only matters to admins; `earthyEnabled()` ignores
 * it for everyone else.
 */
export function EarthyPreviewSync({ value }: { value: "1" | "0" }) {
  useEffect(() => {
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${EARTHY_COOKIE}=${value}; Path=/; Max-Age=${60 * 60 * 24 * 30}; SameSite=Lax${secure}`;
    // Switching the preview off leaves the Summary, so reload the plain URL once the cookie is set.
    if (value === "0") window.location.replace(window.location.pathname);
  }, [value]);
  return value === "0" ? <p className="p-8 text-sm" role="status">Switching to the standard dashboard.</p> : null;
}
