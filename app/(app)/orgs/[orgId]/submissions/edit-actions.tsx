"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Pencil, MapPin, X, Check } from "lucide-react";

interface FormField {
  key: string;
  value: string;
}

interface SubmissionEditActionsProps {
  orgId: string;
  submissionId: string;
  formData: Record<string, unknown>;
  emissionCategoryId: string | null;
  facilityId: string | null;
  pickupPostcode: string | null;
  deliveryPostcode: string | null;
  pickupLat: number | null;
  pickupLng: number | null;
  deliveryLat: number | null;
  deliveryLng: number | null;
  calculatedDistanceKm: number | null;
  distanceSource: string | null;
  emissionCategories: { id: string; scope: number; name: string }[];
  facilities: { id: string; name: string }[];
}

const DISTANCE_SOURCE_LABELS: Record<string, string> = {
  gps_osrm: "Road (OSRM)",
  gps_haversine: "Straight-line estimate",
  postcode: "Postcode route",
};

export function SubmissionEditActions({
  orgId,
  submissionId,
  formData,
  emissionCategoryId: initialCategoryId,
  facilityId: initialFacilityId,
  pickupPostcode: initialPickupPostcode,
  deliveryPostcode: initialDeliveryPostcode,
  pickupLat: initialPickupLat,
  pickupLng: initialPickupLng,
  deliveryLat: initialDeliveryLat,
  deliveryLng: initialDeliveryLng,
  calculatedDistanceKm: initialDistance,
  distanceSource: initialDistanceSource,
  emissionCategories,
  facilities,
}: SubmissionEditActionsProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [fields, setFields] = useState<FormField[]>(
    Object.entries(formData)
      .filter(([, v]) => v != null && v !== "")
      .map(([key, value]) => ({ key, value: String(value) })),
  );
  const [categoryId, setCategoryId] = useState(initialCategoryId ?? "");
  const [facilityId, setFacilityId] = useState(initialFacilityId ?? "");
  const [pickupPostcode, setPickupPostcode] = useState(initialPickupPostcode ?? "");
  const [deliveryPostcode, setDeliveryPostcode] = useState(initialDeliveryPostcode ?? "");
  const [pickupLat, setPickupLat] = useState(initialPickupLat?.toString() ?? "");
  const [pickupLng, setPickupLng] = useState(initialPickupLng?.toString() ?? "");
  const [deliveryLat, setDeliveryLat] = useState(initialDeliveryLat?.toString() ?? "");
  const [deliveryLng, setDeliveryLng] = useState(initialDeliveryLng?.toString() ?? "");
  const [distance, setDistance] = useState(initialDistance);
  const [distanceSource, setDistanceSource] = useState(initialDistanceSource);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function updateField(idx: number, value: string) {
    setFields((prev) => prev.map((f, i) => (i === idx ? { ...f, value } : f)));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);

    const patchFormData = Object.fromEntries(fields.map((f) => [f.key, f.value]));
    const body: Record<string, unknown> = {
      formData: patchFormData,
      emissionCategoryId: categoryId || null,
      facilityId: facilityId || null,
    };

    if (pickupPostcode.trim()) body.pickupPostcode = pickupPostcode.trim();
    if (deliveryPostcode.trim()) body.deliveryPostcode = deliveryPostcode.trim();

    const pLat = pickupLat ? parseFloat(pickupLat) : null;
    const pLng = pickupLng ? parseFloat(pickupLng) : null;
    const dLat = deliveryLat ? parseFloat(deliveryLat) : null;
    const dLng = deliveryLng ? parseFloat(deliveryLng) : null;
    if (pLat !== null) body.pickupLat = pLat;
    if (pLng !== null) body.pickupLng = pLng;
    if (dLat !== null) body.deliveryLat = dLat;
    if (dLng !== null) body.deliveryLng = dLng;

    try {
      const res = await fetch(
        `/api/orgs/${orgId}/field-submissions/${submissionId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.message ?? "Save failed.");
      } else {
        const updated = await res.json();
        setDistance(updated.calculatedDistanceKm ? Number(updated.calculatedDistanceKm) : null);
        setDistanceSource(updated.distanceSource ?? null);
        setSaved(true);
        setIsEditing(false);
      }
    } catch {
      setError("Network error — try again.");
    } finally {
      setSaving(false);
    }
  }

  if (!isEditing) {
    return (
      <div className="flex flex-col gap-3">
        {distance !== null && (
          <div className="flex items-center gap-2 rounded-[10px] border border-[#E5E7EB] bg-[#f9fafb] px-3 py-2">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-[#374151]" />
            <p className="text-sm text-[#374151] tracking-[-0.42px]">
              Road distance:{" "}
              <span className="font-medium text-[#111827]">
                {distance.toFixed(2)} km
              </span>
              {distanceSource && (
                <span className="ml-1 text-xs text-[#374151]">
                  ({DISTANCE_SOURCE_LABELS[distanceSource] ?? distanceSource})
                </span>
              )}
            </p>
          </div>
        )}
        {saved && (
          <p className="text-xs text-[#111827] tracking-[-0.36px] flex items-center gap-1">
            <Check className="h-3.5 w-3.5" /> Changes saved
          </p>
        )}
        <Button
          size="sm"
          variant="outline"
          className="self-start"
          onClick={() => setIsEditing(true)}
        >
          <Pencil className="h-3.5 w-3.5 mr-1.5" />
          Edit values
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-[10px] border border-[#E5E7EB] p-3 space-y-3">
        <p className="text-xs font-medium text-[#374151] tracking-[-0.36px] uppercase">
          Form values
        </p>
        {fields.map((field, idx) => (
          <div key={field.key} className="flex items-center gap-2">
            <label className="text-xs text-[#374151] tracking-[-0.36px] w-32 shrink-0 capitalize">
              {field.key.replace(/([A-Z])/g, " $1").replace(/_/g, " ").trim()}
            </label>
            <Input
              value={field.value}
              onChange={(e) => updateField(idx, e.target.value)}
              className="h-8 text-sm"
            />
          </div>
        ))}
      </div>

      <div className="rounded-[10px] border border-[#E5E7EB] p-3 space-y-3">
        <p className="text-xs font-medium text-[#374151] tracking-[-0.36px] uppercase">
          Dispatch/Delivery postcodes (used for carbon calculation)
        </p>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-[#374151] tracking-[-0.36px]">Pickup postcode</label>
            <Input
              value={pickupPostcode}
              onChange={(e) => setPickupPostcode(e.target.value)}
              placeholder="SW1A 1AA"
              className="h-8 text-sm mt-0.5"
            />
          </div>
          <div>
            <label className="text-xs text-[#374151] tracking-[-0.36px]">Delivery postcode</label>
            <Input
              value={deliveryPostcode}
              onChange={(e) => setDeliveryPostcode(e.target.value)}
              placeholder="M1 1AE"
              className="h-8 text-sm mt-0.5"
            />
          </div>
        </div>
      </div>

      <div className="rounded-[10px] border border-[#E5E7EB] p-3 space-y-3">
        <p className="text-xs font-medium text-[#374151] tracking-[-0.36px] uppercase">
          GPS coordinates (pickup → delivery)
        </p>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-[#374151] tracking-[-0.36px]">Pickup lat</label>
            <Input
              value={pickupLat}
              onChange={(e) => setPickupLat(e.target.value)}
              placeholder="51.5074"
              className="h-8 text-sm mt-0.5"
            />
          </div>
          <div>
            <label className="text-xs text-[#374151] tracking-[-0.36px]">Pickup lng</label>
            <Input
              value={pickupLng}
              onChange={(e) => setPickupLng(e.target.value)}
              placeholder="-0.1278"
              className="h-8 text-sm mt-0.5"
            />
          </div>
          <div>
            <label className="text-xs text-[#374151] tracking-[-0.36px]">Delivery lat</label>
            <Input
              value={deliveryLat}
              onChange={(e) => setDeliveryLat(e.target.value)}
              placeholder="51.5074"
              className="h-8 text-sm mt-0.5"
            />
          </div>
          <div>
            <label className="text-xs text-[#374151] tracking-[-0.36px]">Delivery lng</label>
            <Input
              value={deliveryLng}
              onChange={(e) => setDeliveryLng(e.target.value)}
              placeholder="-0.1278"
              className="h-8 text-sm mt-0.5"
            />
          </div>
        </div>
        <p className="text-xs text-[#555] tracking-[-0.36px]">
          Save to recalculate road distance via OSRM.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        {emissionCategories.length > 0 && (
          <div className="flex flex-col gap-1">
            <label className="text-xs text-[#374151] tracking-[-0.36px]">Emission category</label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger className="w-56 h-8 text-sm">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">None</SelectItem>
                {emissionCategories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    Scope {c.scope}: {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {facilities.length > 0 && (
          <div className="flex flex-col gap-1">
            <label className="text-xs text-[#374151] tracking-[-0.36px]">Facility (optional)</label>
            <Select value={facilityId} onValueChange={setFacilityId}>
              <SelectTrigger className="w-44 h-8 text-sm">
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">None</SelectItem>
                {facilities.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-600 tracking-[-0.42px]">{error}</p>
      )}

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? "Saving…" : "Save changes"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => { setIsEditing(false); setError(null); }}
          disabled={saving}
        >
          <X className="h-3.5 w-3.5 mr-1" />
          Cancel
        </Button>
      </div>
    </div>
  );
}
