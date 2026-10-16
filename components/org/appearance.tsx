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

/** Fired on window after every applyTheme, so the top-bar toggle can show the theme now in force. */
export const THEME_EVENT = "metricora-theme-change";

/** Paints the theme now and writes the cookie the first-paint script reads. */
export function applyTheme(choice: ThemeChoice) {
  const root = document.documentElement;
  const dark = resolveTheme(choice, window.matchMedia(DARK_QUERY).matches) === "dark";
  if (dark) root.setAttribute(THEME_ATTRIBUTE, "dark");
  else root.removeAttribute(THEME_ATTRIBUTE);
  document.cookie = `${THEME_COOKIE}=${choice}; path=/; max-age=31536000; samesite=lax`;
  window.dispatchEvent(new Event(THEME_EVENT));
}

/** Saves the choice to the signed-in person's account. Resolves false when the save did not go through. */
export async function saveTheme(choice: ThemeChoice): Promise<boolean> {
  const res = await fetch("/api/me/theme", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ theme: choice }),
  }).catch(() => null);
  return res?.ok === true;
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

/**
 * Light, dark or system, saved to the signed-in person's account. Shown in each account menu.
 * onChoose runs on any pick, including the current option, so a host drawer can close.
 */
export function AppearanceMenu({ saved, onChoose }: { saved: ThemeChoice | null; onChoose?: () => void }) {
  const [choice, setChoice] = useState<ThemeChoice>(saved ?? "light");

  async function choose(next: string) {
    onChoose?.();
    const parsed = parseThemeChoice(next);
    if (!parsed || parsed === choice) return;
    const previous = choice;
    setChoice(parsed);
    applyTheme(parsed);
    if (!(await saveTheme(parsed))) {
      setChoice(previous);
      applyTheme(previous);
    }
  }

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger className="rounded-lg text-[#41505F] focus:text-[#131d29] focus:bg-[#F9FAFC] cursor-pointer">
        <Sun aria-hidden="true" className="h-4 w-4 mr-2" />
        Appearance
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="w-40 rounded-xl bg-white border-[#E3E8EE] shadow-lg">
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

/**
 * One click between light and dark, for every signed-in person, in the top bar and the mobile header.
 * "System" is still chosen in the account menu; a click here makes the theme explicit.
 */
export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const read = () => setDark(document.documentElement.getAttribute(THEME_ATTRIBUTE) === "dark");
    read();
    window.addEventListener(THEME_EVENT, read);
    return () => window.removeEventListener(THEME_EVENT, read);
  }, []);

  async function flip() {
    const previous: ThemeChoice = dark ? "dark" : "light";
    const next: ThemeChoice = dark ? "light" : "dark";
    applyTheme(next);
    if (!(await saveTheme(next))) applyTheme(previous);
  }

  const label = dark ? "Switch to light theme" : "Switch to dark theme";
  const Icon = dark ? Sun : Moon;
  return (
    <button
      type="button"
      onClick={flip}
      aria-label={label}
      title={label}
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#41505F] transition-colors hover:bg-[#F9FAFC] hover:text-[#131d29] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E3E8EE]"
    >
      <Icon aria-hidden="true" className="h-4 w-4" />
    </button>
  );
}
