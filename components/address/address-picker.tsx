"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import type { AddressSuggestion } from "@/lib/geo/address";

/**
 * Address search box. Typing three or more characters asks our own route for
 * suggestions (debounced); choosing one hands the structured address and
 * position to the parent. If search is unavailable the box is just a text
 * field and the parent keeps whatever was typed.
 */
export function AddressPicker({
  orgId,
  country,
  value,
  onChange,
  onSelect,
  disabled,
  id,
}: {
  orgId: string;
  /** ISO-2 country to prefer, when known. */
  country?: string | null;
  value: string;
  onChange: (text: string) => void;
  onSelect: (s: AddressSuggestion) => void;
  disabled?: boolean;
  id?: string;
}) {
  const listId = useId();
  const [items, setItems] = useState<AddressSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const seq = useRef(0);
  const picked = useRef<string | null>(null);

  useEffect(() => {
    const text = value.trim();
    if (text.length < 3 || text === picked.current) {
      setItems([]);
      return;
    }
    const mine = ++seq.current;
    const timer = setTimeout(async () => {
      try {
        const qs = new URLSearchParams({ q: text, ...(country ? { country } : {}) });
        const res = await fetch(`/api/orgs/${orgId}/geocode/autocomplete?${qs}`);
        if (mine !== seq.current) return;
        if (!res.ok) {
          setItems([]);
          setNote(res.status === 503 ? "Address search is not available; type the address." : null);
          return;
        }
        setNote(null);
        setItems((await res.json()).suggestions ?? []);
        setOpen(true);
      } catch {
        if (mine === seq.current) setItems([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [value, country, orgId]);

  return (
    <div className="relative">
      <Input
        id={id}
        value={value}
        disabled={disabled}
        autoComplete="off"
        role="combobox"
        aria-expanded={open && items.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        onChange={(e) => { picked.current = null; onChange(e.target.value); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        maxLength={300}
      />
      {open && items.length > 0 && (
        <ul id={listId} role="listbox" className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-md border bg-white text-sm shadow-lg">
          {items.map((s, i) => (
            <li
              key={`${s.label}-${i}`}
              role="option"
              aria-selected={false}
              className="cursor-pointer px-3 py-2 hover:bg-slate-100"
              onMouseDown={(e) => {
                e.preventDefault();
                picked.current = s.label;
                onChange(s.label);
                onSelect(s);
                setItems([]);
                setOpen(false);
              }}
            >
              {s.label}
            </li>
          ))}
          <li className="px-3 py-1 text-[11px] text-slate-500" aria-hidden="true">
            Address search by Geoapify, © OpenStreetMap contributors
          </li>
        </ul>
      )}
      {note && <p className="mt-1 text-xs text-slate-500">{note}</p>}
    </div>
  );
}
