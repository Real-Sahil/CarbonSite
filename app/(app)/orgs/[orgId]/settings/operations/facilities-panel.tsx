"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2, MapPin, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AddressPicker } from "@/components/address/address-picker";
import { FormActions, FormDisclosure, FormError, FormField, FormSection, fieldClass } from "@/components/forms/form-kit";
import { plusCode, type AddressSuggestion } from "@/lib/geo/address";
import { EmptyState } from "@/components/ui/empty-state";
import { EGRID_SUBREGIONS } from "@/lib/calculation/egrid-subregion";
import { countryIso2 } from "@/lib/calculation/geography";

export type WaterStressLevel = "low" | "medium_high" | "high" | "extremely_high" | "unknown";

export type Facility = {
  id: string;
  name: string;
  country: string;
  region: string;
  addressLine: string;
  postcode: string;
  latitude: number | null;
  longitude: number | null;
  waterStressLevel: WaterStressLevel | null;
  egridSubregion: string;
};

const WATER_STRESS_OPTIONS: { value: WaterStressLevel | ""; label: string }[] = [
  { value: "", label: "Not assessed" },
  { value: "low", label: "Low" },
  { value: "medium_high", label: "Medium-high" },
  { value: "high", label: "High" },
  { value: "extremely_high", label: "Extremely high" },
  { value: "unknown", label: "Unknown / data unavailable" },
];

const EMPTY: Facility = {
  id: "",
  name: "",
  country: "",
  region: "",
  addressLine: "",
  postcode: "",
  latitude: null,
  longitude: null,
  waterStressLevel: null,
  egridSubregion: "",
};

async function send(url: string, method: "POST" | "PATCH" | "DELETE", payload?: Record<string, unknown>) {
  const res = await fetch(url, {
    method,
    headers: payload ? { "Content-Type": "application/json" } : undefined,
    body: payload ? JSON.stringify(payload) : undefined,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.message ?? "Request failed");
  }
}

/** Where a facility sits, as a person would say it. */
function locationLine(f: Facility) {
  return [f.addressLine, f.postcode, f.region, f.country].filter(Boolean).join(", ");
}

export function FacilitiesPanel({ orgId, facilities }: { orgId: string; facilities: Facility[] }) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const placed = facilities.filter((f) => f.latitude != null && f.longitude != null).length;

  return (
    <div className="max-w-full overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Facilities</h2>
          <p className="mt-1 text-sm text-slate-500">
            Sites, depots and project locations used by records and field submissions.
            {facilities.length > 0 && ` ${placed} of ${facilities.length} placed on the site map.`}
          </p>
        </div>
        {!adding && (
          <Button type="button" size="sm" onClick={() => { setAdding(true); setEditing(null); }}>
            <Plus className="h-4 w-4" />
            Add facility
          </Button>
        )}
      </div>

      {adding && (
        <div className="border-t border-slate-100 bg-slate-50/50 p-4">
          <FacilityForm
            orgId={orgId}
            initial={EMPTY}
            submitLabel="Add facility"
            onCancel={() => setAdding(false)}
            onDone={() => setAdding(false)}
          />
        </div>
      )}

      {facilities.length === 0 && !adding ? (
        <div className="border-t border-slate-100">
          <EmptyState icon={Building2} title="No facilities yet" description="Add the first site to place records and field submissions." />
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 border-t border-slate-100">
          {facilities.map((facility) => (
            <li key={facility.id}>
              {editing === facility.id ? (
                <div className="bg-slate-50/50 p-4">
                  <FacilityForm
                    orgId={orgId}
                    initial={facility}
                    submitLabel="Save changes"
                    onCancel={() => setEditing(null)}
                    onDone={() => setEditing(null)}
                  />
                </div>
              ) : (
                <div className="flex items-start justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">{facility.name}</p>
                    <p className="mt-0.5 truncate text-xs text-slate-500">{locationLine(facility) || "No address yet"}</p>
                    <p className={`mt-1 inline-flex items-center gap-1 text-xs ${facility.latitude != null ? "text-emerald-700" : "text-amber-700"}`}>
                      <MapPin className="h-3 w-3" aria-hidden="true" />
                      {facility.latitude != null ? "On the site map" : "Not on the site map: choose an address from the search"}
                    </p>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={() => { setEditing(facility.id); setAdding(false); }}>
                    Edit
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** One form for adding and editing, so the two never drift apart. */
function FacilityForm({
  orgId,
  initial,
  submitLabel,
  onCancel,
  onDone,
}: {
  orgId: string;
  initial: Facility;
  submitLabel: string;
  onCancel: () => void;
  onDone: () => void;
}) {
  const router = useRouter();
  const isNew = !initial.id;
  const [name, setName] = useState(initial.name);
  const [address, setAddress] = useState(initial.addressLine);
  const [country, setCountry] = useState(initial.country);
  const [region, setRegion] = useState(initial.region);
  const [postcode, setPostcode] = useState(initial.postcode);
  const [egrid, setEgrid] = useState(initial.egridSubregion);
  const [water, setWater] = useState<WaterStressLevel | "">(initial.waterStressLevel ?? "");
  const [picked, setPicked] = useState<AddressSuggestion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const id = `facility-${initial.id || "new"}`;

  const position = picked
    ? { latitude: picked.latitude, longitude: picked.longitude }
    : initial.latitude != null && initial.longitude != null
      ? { latitude: initial.latitude, longitude: initial.longitude }
      : null;

  function pick(s: AddressSuggestion) {
    setPicked(s);
    if (s.country) setCountry(s.country);
    setRegion(s.region ?? "");
    setPostcode(s.postcode ?? "");
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const addressChanged = address !== initial.addressLine;
    // A chosen suggestion gives the structured address and the position; typed text alone is kept as the street line.
    const location = picked
      ? { addressLine: picked.addressLine || address, latitude: picked.latitude, longitude: picked.longitude }
      : addressChanged
        ? { addressLine: address || undefined }
        : {};
    startTransition(async () => {
      try {
        if (isNew) {
          await send(`/api/orgs/${orgId}/facilities`, "POST", {
            name, country, region, postcode: postcode.trim() || undefined, ...location,
            ...(water ? { waterStressLevel: water } : {}),
            ...(egrid ? { egridSubregion: egrid } : {}),
          });
        } else {
          await send(`/api/orgs/${orgId}/facilities/${initial.id}`, "PATCH", {
            name, country, region, postcode: postcode.trim() || null, waterStressLevel: water || null, egridSubregion: egrid || null, ...location,
          });
        }
        router.refresh();
        onDone();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save the facility");
      }
    });
  }

  function remove() {
    if (!window.confirm(`Delete ${initial.name}? Records using this facility will block deletion.`)) return;
    setError(null);
    startTransition(async () => {
      try {
        await send(`/api/orgs/${orgId}/facilities/${initial.id}`, "DELETE");
        router.refresh();
        onDone();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not delete the facility");
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <FormSection title="Site">
        <FormField label="Name" htmlFor={`${id}-name`} span={2}>
          <Input id={`${id}-name`} value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} disabled={isPending} />
        </FormField>
      </FormSection>

      <FormSection title="Location" description="All optional. Search for the address: choosing a result fills the fields below and places the site on the map.">
        <FormField label="Address" htmlFor={`${id}-address`} span={4}>
          <AddressPicker
            id={`${id}-address`}
            orgId={orgId}
            country={country.length === 2 ? country : null}
            value={address}
            onChange={setAddress}
            onSelect={pick}
            disabled={isPending}
          />
        </FormField>
        <FormField label="Country" htmlFor={`${id}-country`} hint="Two-letter code, e.g. GB">
          <Input id={`${id}-country`} value={country} onChange={(e) => setCountry(e.target.value)} maxLength={80} disabled={isPending} />
        </FormField>
        <FormField label="Region" htmlFor={`${id}-region`} span={2}>
          <Input id={`${id}-region`} value={region} onChange={(e) => setRegion(e.target.value)} maxLength={80} disabled={isPending} />
        </FormField>
        <FormField label="Postcode" htmlFor={`${id}-postcode`}>
          <Input id={`${id}-postcode`} value={postcode} onChange={(e) => setPostcode(e.target.value)} maxLength={20} disabled={isPending} />
        </FormField>
        {countryIso2(country) === "US" && (
          <FormField
            label="eGRID subregion"
            htmlFor={`${id}-egrid`}
            span={2}
            optional
            hint="Prices this site's electricity with its regional grid. Left empty, the US average is used. Find yours from the site's ZIP code in EPA's Power Profiler."
          >
            <select id={`${id}-egrid`} value={egrid} disabled={isPending} onChange={(e) => setEgrid(e.target.value)} className={fieldClass}>
              <option value="">US average</option>
              {EGRID_SUBREGIONS.map((s) => (
                <option key={s.code} value={s.code}>{s.code}, {s.name}</option>
              ))}
            </select>
          </FormField>
        )}
        {position && (
          <p className="text-xs text-slate-500 @md:col-span-full">
            Position {position.latitude.toFixed(5)}, {position.longitude.toFixed(5)} (Plus Code {plusCode(position.latitude, position.longitude)}).
          </p>
        )}
      </FormSection>

      <FormDisclosure title="Water risk (ESRS E3)">
        <FormField label="Water-stress classification" htmlFor={`${id}-water`} span={2} optional>
          <select
            id={`${id}-water`}
            value={water}
            disabled={isPending}
            onChange={(e) => setWater(e.target.value as WaterStressLevel | "")}
            className="h-9 w-full rounded-[8px] border border-[#E5E7EB] bg-white px-3 text-sm disabled:opacity-50"
          >
            {WATER_STRESS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </FormField>
      </FormDisclosure>

      <FormError>{error}</FormError>

      <FormActions
        start={
          !isNew && (
            <Button type="button" variant="ghost" size="sm" className="text-red-700 hover:text-red-800" onClick={remove} disabled={isPending}>
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          )
        }
      >
        <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={isPending}>Cancel</Button>
        <Button type="submit" size="sm" disabled={isPending || name.trim().length === 0}>{submitLabel}</Button>
      </FormActions>
    </form>
  );
}
