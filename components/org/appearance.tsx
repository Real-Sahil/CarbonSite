"use client";

import { useEffect, useState } from "react";
import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import {
  DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSub,
  DropdownMenuSubContent, DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import {
  DARK_QUERY, THEME_ATTRIBUTE, THEME_COOKIE, parseThemeChoice, resolveTheme,
  type ThemeChoice,
} from "@/lib/theme/preference";

const OPTIONS: { value: ThemeChoice; label: string; icon: LucideIcon }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

/** Paints the theme now and writes the cookie the first-paint script reads. */
export function applyTheme(choice: ThemeChoice) {
  const root = document.documentElement;
  const dark = resolveTheme(choice, window.matchMedia(DARK_QUERY).matches) === "dark";
  if (dark) root.setAttribute(THEME_ATTRIBUTE, "dark");
  else root.removeAttribute(THEME_ATTRIBUTE);
  document.cookie = `${THEME_COOKIE}=${choice}; path=/; max-age=31536000; samesite=lax`;
}

/**
 * Brings the page in line with the saved choice (the database is the source of
 * truth, the cookie only serves the next first paint) and follows the OS while
 * the choice is "system".
 */
export function AppearanceSync({ saved }: { saved: ThemeChoice | null }) {
  const choice = saved ?? "light";
  useEffect(() => {
    applyTheme(choice);
    if (choice !== "system") return;
    const media = window.matchMedia(DARK_QUERY);
    const onChange = () => applyTheme("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [choice]);
  return null;
}

/** Light, dark or system, saved to the signed-in person's account. Shown in each account menu. */
export function AppearanceMenu({ saved }: { saved: ThemeChoice | null }) {
  const [choice, setChoice] = useState<ThemeChoice>(saved ?? "light");

  async function choose(next: string) {
    const parsed = parseThemeChoice(next);
    if (!parsed || parsed === choice) return;
    const previous = choice;
    setChoice(parsed);
    applyTheme(parsed);
    const res = await fetch("/api/me/theme", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ theme: parsed }),
    }).catch(() => null);
    if (!res?.ok) {
      setChoice(previous);
      applyTheme(previous);
    }
  }

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger className="rounded-lg text-slate-600 focus:text-slate-900 focus:bg-slate-100 cursor-pointer">
        <Sun aria-hidden="true" className="h-4 w-4 mr-2" />
        Appearance
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="w-40 rounded-xl bg-white border-slate-200 shadow-lg">
        <DropdownMenuRadioGroup value={choice} onValueChange={choose}>
          {OPTIONS.map(({ value, label, icon: Icon }) => (
            <DropdownMenuRadioItem key={value} value={value} className="rounded-lg cursor-pointer">
              <Icon aria-hidden="true" className="h-4 w-4 mr-2" />
              {label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}
