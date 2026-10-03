"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { countryIso2 } from "@/lib/calculation/geography";
import { missingIdentifiers } from "@/lib/exports/mrv-identifiers";

type Facility = {
  id: string;
  name: string;
  country: string | null;
  addressLine: string | null;
  latitude: string | number | null;
  longitude: string | number | null;
  economicLicenceNumber: string | null;
  environmentalPermitNumber: string | null;
};

function FacilityCard({ orgId, facility, onSaved }: { orgId: string; facility: Facility; onSaved: () => void }) {
  const thisYear = new Date().getFullYear();
  const [licence, setLicence] = useState(facility.economicLicenceNumber ?? "");
  const [permit, setPermit] = useState(facility.environmentalPermitNumber ?? "");
  const [year, setYear] = useState(thisYear - 1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const changed = licence !== (facility.economicLicenceNumber ?? "") || permit !== (facility.environmentalPermitNumber ?? "");
  const missing = missingIdentifiers({
    economicLicenceNumber: licence || null,
    environmentalPermitNumber: permit || null,
    address: facility.addressLine,
    latitude: facility.latitude == null ? null : Number(facility.latitude),
    longitude: facility.longitude == null ? null : Number(facility.longitude),
  });

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/orgs/${orgId}/facilities/${facility.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ economicLicenceNumber: licence || null, environmentalPermitNumber: permit || null }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message ?? "Could not save.");
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="border-gray-200">
      <CardContent className="space-y-4 pt-5">
        <h2 className="font-semibold text-gray-900">{facility.name}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`lic-${facility.id}`}>Economic licence number</Label>
            <Input id={`lic-${facility.id}`} value={licence} maxLength={60} disabled={busy} onChange={(e) => setLicence(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`perm-${facility.id}`}>Environmental permit number</Label>
            <Input id={`perm-${facility.id}`} value={permit} maxLength={60} disabled={busy} onChange={(e) => setPermit(e.target.value)} />
          </div>
        </div>
        {missing.length > 0 && (
          <p className="text-sm text-amber-700">Still to add before filing: {missing.join(", ")}. Address and coordinates are set under Settings, Operations.</p>
        )}
        <div className="flex flex-wrap items-end gap-3">
          <Button type="button" variant="outline" disabled={busy || !changed} onClick={save}>Save identifiers</Button>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`yr-${facility.id}`}>Calendar year</Label>
            <select
              id={`yr-${facility.id}`}
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="h-9 rounded-md border bg-transparent px-3 text-sm"
            >
              {[thisYear, thisYear - 1, thisYear - 2].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <Button asChild disabled={changed}>
            <a href={`/api/orgs/${orgId}/exports/abu-dhabi-mrv?facilityId=${facility.id}&year=${year}`}>Download Scope 1 workbook</a>
          </Button>
        </div>
        {changed && <p className="text-xs text-gray-500">Save the identifiers first so the workbook carries them.</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </CardContent>
    </Card>
  );
}

export default function AbuDhabiMrvPage() {
  const params = useParams();
  const orgId = Array.isArray(params.orgId) ? params.orgId[0] : params.orgId;
  const [facilities, setFacilities] = useState<Facility[] | null>(null);

  const load = useCallback(() => {
    if (!orgId) return;
    fetch(`/api/orgs/${orgId}/facilities`)
      .then((r) => r.json())
      .then((json) => setFacilities(Array.isArray(json) ? json : []))
      .catch(() => setFacilities([]));
  }, [orgId]);

  useEffect(load, [load]);

  const uae = (facilities ?? []).filter((f) => countryIso2(f.country) === "AE");

  return (
    <div className="space-y-6 p-6">
      <div>
        <Link href={`/orgs/${orgId}/compliance/deadlines`} className="text-sm text-blue-600 hover:underline">Regulatory calendar</Link>
        <h1 className="mt-2 text-3xl font-bold text-gray-900">Abu Dhabi MRV: facility Scope 1 data</h1>
        <p className="mt-2 max-w-3xl text-gray-600">
          Facility-level Scope 1 emissions for a calendar year, taken from your latest published snapshot that covers the whole year, in the order of the Environment Agency&apos;s identifier and source stream sections.
          It is not the Agency&apos;s template: copy the figures across and file through the Agency&apos;s portal. Sections only you can complete, such as the facility description, measurement based sources, verification and mitigation, are not filled.
          Whether a facility must report depends on its sector and on emitting 25,000 tCO2e or more; check with the Agency.
        </p>
      </div>
      {facilities === null && <p className="text-sm text-gray-500">Loading facilities…</p>}
      {facilities !== null && uae.length === 0 && (
        <p className="text-sm text-gray-600">No facility is set to the United Arab Emirates. Set a facility&apos;s country under Settings, Operations.</p>
      )}
      {uae.map((f) => (
        <FacilityCard key={f.id} orgId={orgId!} facility={f} onSaved={load} />
      ))}
    </div>
  );
}
