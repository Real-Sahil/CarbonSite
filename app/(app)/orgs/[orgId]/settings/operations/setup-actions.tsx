"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Save, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiDataSourcesPanel } from "./api-data-sources";

type ReportingPeriod = {
  id: string;
  label: string;
  type: string;
  startDate: string;
  endDate: string;
  status: string;
};

type Facility = {
  id: string;
  name: string;
  country: string;
  region: string;
};

type BusinessUnit = {
  id: string;
  name: string;
};

type FactorLibrary = {
  factorCount: number;
  id: string;
  name: string;
  version: string;
};

type ApiDataSourceRow = {
  id: string;
  name: string;
  endpoint: string;
  authMethod: "none" | "api_key" | "bearer" | "basic";
  dataFormat: "json" | "csv";
  enabled: boolean;
  lastSyncAt: string | null;
  lastErrorAt: string | null;
  lastErrorMessage: string | null;
  syncIntervalMins: number;
};

const PERIOD_TYPES = ["month", "quarter", "year", "custom"] as const;
const PERIOD_STATUSES = ["draft", "published", "locked"] as const;

const INDUSTRY_OPTIONS = [
  { value: "", label: "General / not specified" },
  { value: "construction", label: "Construction" },
  { value: "logistics", label: "Logistics and transport" },
  { value: "facilities_management", label: "Facilities management" },
  { value: "public_procurement", label: "Public procurement (PPN 006)" },
  { value: "manufacturing", label: "Manufacturing" },
  { value: "retail", label: "Retail and wholesale" },
  { value: "financial_services", label: "Financial services" },
  { value: "healthcare", label: "Healthcare" },
  { value: "hospitality", label: "Hospitality and leisure" },
  { value: "professional_services", label: "Professional services" },
] as const;

const CURRENCY_OPTIONS = ["GBP", "USD", "EUR", "AUD", "CAD", "SGD"] as const;

async function requestJson(
  url: string,
  method: "POST" | "PATCH" | "DELETE",
  payload?: Record<string, unknown>,
) {
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

type OrgProfile = {
  name: string;
  industry: string;
  hqCountry: string;
  reportingCurrency: string;
};

export function OperationsSetup({
  orgId,
  orgProfile,
  periods,
  facilities,
  businessUnits,
  factorLibraries,
  apiDataSources,
}: {
  orgId: string;
  orgProfile: OrgProfile;
  periods: ReportingPeriod[];
  facilities: Facility[];
  businessUnits: BusinessUnit[];
  factorLibraries: FactorLibrary[];
  apiDataSources: ApiDataSourceRow[];
}) {
  return (
    <div className="grid gap-6 xl:grid-cols-2 max-w-5xl">
      <section className="xl:col-span-2">
        <OrgProfilePanel orgId={orgId} profile={orgProfile} />
      </section>
      <section className="xl:col-span-2">
        <ReportingPeriodsPanel orgId={orgId} periods={periods} />
      </section>
      <FacilitiesPanel orgId={orgId} facilities={facilities} />
      <BusinessUnitsPanel orgId={orgId} businessUnits={businessUnits} />
      <section className="xl:col-span-2">
        <FactorImportPanel orgId={orgId} factorLibraries={factorLibraries} />
      </section>
      <section className="xl:col-span-2">
        <ApiDataSourcesPanel orgId={orgId} sources={apiDataSources} />
      </section>
    </div>
  );
}

function OrgProfilePanel({ orgId, profile }: { orgId: string; profile: OrgProfile }) {
  const router = useRouter();
  const [name, setName] = useState(profile.name);
  const [industry, setIndustry] = useState(profile.industry);
  const [hqCountry, setHqCountry] = useState(profile.hqCountry);
  const [currency, setCurrency] = useState(profile.reportingCurrency);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const changed =
    name !== profile.name ||
    industry !== profile.industry ||
    hqCountry !== profile.hqCountry ||
    currency !== profile.reportingCurrency;

  function save() {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      try {
        await requestJson(`/api/orgs/${orgId}`, "PATCH", {
          name: name.trim() || undefined,
          industry: industry || null,
          hqCountry: hqCountry.trim() || null,
          reportingCurrency: currency || undefined,
        });
        setSuccess("Organisation profile saved.");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save profile");
      }
    });
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <PanelHeader
        title="Organisation profile"
        description="Industry classification drives sector-specific dashboard widgets and report defaults."
      />
      <div className="grid gap-3 border-t border-slate-100 p-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Organisation name">
          <Input value={name} disabled={isPending} onChange={(e) => setName(e.target.value)} maxLength={200} />
        </Field>
        <Field label="Industry">
          <select
            value={industry}
            disabled={isPending}
            onChange={(e) => setIndustry(e.target.value)}
            className={selectClass}
          >
            {INDUSTRY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="HQ country">
          <Input
            value={hqCountry}
            disabled={isPending}
            onChange={(e) => setHqCountry(e.target.value)}
            maxLength={100}
            placeholder="e.g. United Kingdom"
          />
        </Field>
        <Field label="Reporting currency">
          <select
            value={currency}
            disabled={isPending}
            onChange={(e) => setCurrency(e.target.value)}
            className={selectClass}
          >
            {CURRENCY_OPTIONS.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </Field>
      </div>
      <div className="flex items-center gap-3 border-t border-slate-100 px-4 py-3">
        <Button type="button" disabled={isPending || !changed} onClick={save}>
          <Save className="h-4 w-4" />
          Save profile
        </Button>
        {success && <p className="text-sm text-green-700">{success}</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </div>
  );
}

function FactorImportPanel({
  orgId,
  factorLibraries,
}: {
  orgId: string;
  factorLibraries: FactorLibrary[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const canImport = factorLibraries.length > 0;

  function importFactors(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    const formEl = event.currentTarget;
    const form = new FormData(formEl);

    startTransition(async () => {
      try {
        const res = await fetch(`/api/orgs/${orgId}/factors/import`, {
          method: "POST",
          body: form,
        });
        const body = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(body?.message ?? "Factor import failed");
        }
        formEl.reset();
        setSuccess(`${body.importedRows} factor rows imported.`);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Factor import failed");
      }
    });
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <PanelHeader
        title="Emission factor import"
        description="Load governed factor rows into an approved library for deterministic calculation runs."
      />
      <form onSubmit={importFactors} className="grid gap-3 border-t border-slate-100 p-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-[1fr_1fr_auto]">
        <Field label="Factor library">
          <select
            name="factorLibraryId"
            required
            disabled={!canImport || isPending}
            className={selectClass}
          >
            {factorLibraries.map((library) => (
              <option key={library.id} value={library.id}>
                {library.name} {library.version} ({library.factorCount} rows)
              </option>
            ))}
          </select>
        </Field>
        <Field label="Factor file">
          <input
            name="file"
            type="file"
            accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            required
            disabled={!canImport || isPending}
            className="h-9 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm shadow-sm file:mr-3 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:cursor-not-allowed disabled:opacity-50"
          />
        </Field>
        <div className="flex items-end">
          <Button type="submit" disabled={!canImport || isPending}>
            <Upload className="h-4 w-4" />
            Import factors
          </Button>
        </div>
        {!canImport && (
          <p className="text-sm text-slate-500 lg:col-span-3">
            Seed methodology and approved factor libraries before importing factor rows.
          </p>
        )}
        <p className="text-xs leading-5 text-slate-500 lg:col-span-3">
          Required columns: scope, input_unit, and at least one of co2e, co2, ch4, or n2o. Optional columns include external_id, emission_category_code, activity_type, geography_country, geography_region, effective_start_date, effective_end_date, uncertainty_rating, and usage_notes.
        </p>
        {success && <p className="text-sm text-green-700 lg:col-span-3">{success}</p>}
        {error && <p className="whitespace-pre-line text-sm text-red-600 lg:col-span-3">{error}</p>}
      </form>
    </div>
  );
}

function ReportingPeriodsPanel({
  orgId,
  periods,
}: {
  orgId: string;
  periods: ReportingPeriod[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function createPeriod(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const formEl = event.currentTarget;
    const form = new FormData(formEl);

    startTransition(async () => {
      try {
        await requestJson(`/api/orgs/${orgId}/reporting-periods`, "POST", {
          label: form.get("label"),
          type: form.get("type"),
          startDate: form.get("startDate"),
          endDate: form.get("endDate"),
        });
        formEl.reset();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not create period");
      }
    });
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <PanelHeader
        title="Reporting periods"
        description="Define the periods used by imports, field submissions, calculations, snapshots, and reports."
      />
      <div className="border-t border-slate-100 p-4">
        <form onSubmit={createPeriod} className="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-[1fr_9rem_10rem_10rem_auto]">
          <Field label="Label">
            <Input name="label" required maxLength={100} disabled={isPending} />
          </Field>
          <Field label="Type">
            <select name="type" className={selectClass} disabled={isPending} defaultValue="month">
              {PERIOD_TYPES.map((type) => (
                <option key={type} value={type}>
                  {labelise(type)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Start">
            <Input name="startDate" type="date" required disabled={isPending} />
          </Field>
          <Field label="End">
            <Input name="endDate" type="date" required disabled={isPending} />
          </Field>
          <div className="flex items-end">
            <Button type="submit" disabled={isPending}>
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </div>
        </form>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>
      <div className="border-t border-slate-100">
        {periods.length === 0 ? (
          <EmptyRow text="No reporting periods yet." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Label</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Start</th>
                  <th className="px-4 py-3">End</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {periods.map((period) => (
                  <ReportingPeriodRow key={period.id} orgId={orgId} period={period} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function ReportingPeriodRow({
  orgId,
  period,
}: {
  orgId: string;
  period: ReportingPeriod;
}) {
  const router = useRouter();
  const [label, setLabel] = useState(period.label);
  const [type, setType] = useState(period.type);
  const [startDate, setStartDate] = useState(toDateInput(period.startDate));
  const [endDate, setEndDate] = useState(toDateInput(period.endDate));
  const [status, setStatus] = useState(period.status);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const locked = period.status === "locked";
  const changed =
    label !== period.label ||
    type !== period.type ||
    startDate !== toDateInput(period.startDate) ||
    endDate !== toDateInput(period.endDate) ||
    status !== period.status;

  function save() {
    setError(null);
    startTransition(async () => {
      try {
        await requestJson(`/api/orgs/${orgId}/reporting-periods/${period.id}`, "PATCH", {
          label,
          type,
          startDate,
          endDate,
          status,
        });
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not update period");
      }
    });
  }

  return (
    <tr className="border-t border-slate-100 align-top">
      <td className="px-4 py-3">
        <Input value={label} disabled={isPending || locked} onChange={(event) => setLabel(event.target.value)} />
      </td>
      <td className="px-4 py-3">
        <select value={type} disabled={isPending || locked} onChange={(event) => setType(event.target.value)} className={selectClass}>
          {PERIOD_TYPES.map((item) => (
            <option key={item} value={item}>
              {labelise(item)}
            </option>
          ))}
        </select>
      </td>
      <td className="px-4 py-3">
        <Input type="date" value={startDate} disabled={isPending || locked} onChange={(event) => setStartDate(event.target.value)} />
      </td>
      <td className="px-4 py-3">
        <Input type="date" value={endDate} disabled={isPending || locked} onChange={(event) => setEndDate(event.target.value)} />
      </td>
      <td className="px-4 py-3">
        <select value={status} disabled={isPending || locked} onChange={(event) => setStatus(event.target.value)} className={selectClass}>
          {PERIOD_STATUSES.map((item) => (
            <option key={item} value={item}>
              {labelise(item)}
            </option>
          ))}
        </select>
        {locked && <p className="mt-1 text-xs text-slate-500">Locked periods cannot be edited.</p>}
      </td>
      <td className="px-4 py-3">
        <Button type="button" size="icon" variant="outline" title="Save period" disabled={isPending || locked || !changed} onClick={save}>
          <Save className="h-4 w-4" />
        </Button>
        {error && <p className="mt-1 max-w-48 text-xs text-red-600">{error}</p>}
      </td>
    </tr>
  );
}

function FacilitiesPanel({
  orgId,
  facilities,
}: {
  orgId: string;
  facilities: Facility[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function createFacility(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const formEl = event.currentTarget;
    const form = new FormData(formEl);

    startTransition(async () => {
      try {
        await requestJson(`/api/orgs/${orgId}/facilities`, "POST", {
          name: form.get("name"),
          country: form.get("country"),
          region: form.get("region"),
        });
        formEl.reset();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not create facility");
      }
    });
  }

  return (
    <EntityPanel title="Facilities" description="Site, depot, and project locations used by records and field submissions.">
      <form onSubmit={createFacility} className="grid gap-3 border-b border-slate-100 p-4 grid-cols-1 md:grid-cols-[1fr_8rem_10rem_auto]">
        <Field label="Name">
          <Input name="name" required maxLength={100} disabled={isPending} />
        </Field>
        <Field label="Country">
          <Input name="country" maxLength={80} disabled={isPending} />
        </Field>
        <Field label="Region">
          <Input name="region" maxLength={80} disabled={isPending} />
        </Field>
        <div className="flex items-end">
          <Button type="submit" disabled={isPending}>
            <Plus className="h-4 w-4" />
            Add
          </Button>
        </div>
        {error && <p className="text-sm text-red-600 sm:col-span-4">{error}</p>}
      </form>
      {facilities.length === 0 ? (
        <EmptyRow text="No facilities yet." />
      ) : (
        <div className="divide-y divide-slate-100">
          {facilities.map((facility) => (
            <FacilityRow key={facility.id} orgId={orgId} facility={facility} />
          ))}
        </div>
      )}
    </EntityPanel>
  );
}

function FacilityRow({ orgId, facility }: { orgId: string; facility: Facility }) {
  const router = useRouter();
  const [name, setName] = useState(facility.name);
  const [country, setCountry] = useState(facility.country ?? "");
  const [region, setRegion] = useState(facility.region ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const changed = name !== facility.name || country !== (facility.country ?? "") || region !== (facility.region ?? "");

  function save() {
    setError(null);
    startTransition(async () => {
      try {
        await requestJson(`/api/orgs/${orgId}/facilities/${facility.id}`, "PATCH", { name, country, region });
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not update facility");
      }
    });
  }

  function remove() {
    if (!window.confirm(`Delete ${facility.name}? Records using this facility will block deletion.`)) return;
    setError(null);
    startTransition(async () => {
      try {
        await requestJson(`/api/orgs/${orgId}/facilities/${facility.id}`, "DELETE");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not delete facility");
      }
    });
  }

  return (
    <div className="grid gap-3 p-4 grid-cols-1 md:grid-cols-[1fr_8rem_10rem_auto]">
      <Input value={name} disabled={isPending} onChange={(event) => setName(event.target.value)} />
      <Input value={country} disabled={isPending} onChange={(event) => setCountry(event.target.value)} />
      <Input value={region} disabled={isPending} onChange={(event) => setRegion(event.target.value)} />
      <RowActions save={save} remove={remove} disabled={isPending} canSave={changed && name.trim().length > 0} />
      {error && <p className="text-xs text-red-600 md:col-span-4">{error}</p>}
    </div>
  );
}

function BusinessUnitsPanel({
  orgId,
  businessUnits,
}: {
  orgId: string;
  businessUnits: BusinessUnit[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function createBusinessUnit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const formEl = event.currentTarget;
    const form = new FormData(formEl);

    startTransition(async () => {
      try {
        await requestJson(`/api/orgs/${orgId}/business-units`, "POST", {
          name: form.get("name"),
        });
        formEl.reset();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not create business unit");
      }
    });
  }

  return (
    <EntityPanel title="Business units" description="Internal divisions used for responsibility, reporting, and rollups.">
      <form onSubmit={createBusinessUnit} className="grid gap-3 border-b border-slate-100 p-4 grid-cols-1 md:grid-cols-[1fr_auto]">
        <Field label="Name">
          <Input name="name" required maxLength={100} disabled={isPending} />
        </Field>
        <div className="flex items-end">
          <Button type="submit" disabled={isPending}>
            <Plus className="h-4 w-4" />
            Add
          </Button>
        </div>
        {error && <p className="text-sm text-red-600 sm:col-span-2">{error}</p>}
      </form>
      {businessUnits.length === 0 ? (
        <EmptyRow text="No business units yet." />
      ) : (
        <div className="divide-y divide-slate-100">
          {businessUnits.map((businessUnit) => (
            <BusinessUnitRow key={businessUnit.id} orgId={orgId} businessUnit={businessUnit} />
          ))}
        </div>
      )}
    </EntityPanel>
  );
}

function BusinessUnitRow({
  orgId,
  businessUnit,
}: {
  orgId: string;
  businessUnit: BusinessUnit;
}) {
  const router = useRouter();
  const [name, setName] = useState(businessUnit.name);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function save() {
    setError(null);
    startTransition(async () => {
      try {
        await requestJson(`/api/orgs/${orgId}/business-units/${businessUnit.id}`, "PATCH", { name });
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not update business unit");
      }
    });
  }

  function remove() {
    if (!window.confirm(`Delete ${businessUnit.name}? Records using this business unit will block deletion.`)) return;
    setError(null);
    startTransition(async () => {
      try {
        await requestJson(`/api/orgs/${orgId}/business-units/${businessUnit.id}`, "DELETE");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not delete business unit");
      }
    });
  }

  return (
    <div className="grid gap-3 p-4 grid-cols-1 md:grid-cols-[1fr_auto]">
      <Input value={name} disabled={isPending} onChange={(event) => setName(event.target.value)} />
      <RowActions save={save} remove={remove} disabled={isPending} canSave={name !== businessUnit.name && name.trim().length > 0} />
      {error && <p className="text-xs text-red-600 md:col-span-2">{error}</p>}
    </div>
  );
}

function EntityPanel({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <PanelHeader title={title} description={description} />
      {children}
    </div>
  );
}

function PanelHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="p-4">
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      <p className="mt-1 text-sm text-slate-500">{description}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="mb-1.5 block text-xs font-medium text-slate-600">{label}</Label>
      {children}
    </div>
  );
}

function RowActions({
  save,
  remove,
  disabled,
  canSave,
}: {
  save: () => void;
  remove: () => void;
  disabled: boolean;
  canSave: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <Button type="button" size="icon" variant="outline" title="Save" disabled={disabled || !canSave} onClick={save}>
        <Save className="h-4 w-4" />
      </Button>
      <Button type="button" size="icon" variant="outline" title="Delete" disabled={disabled} onClick={remove}>
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

function EmptyRow({ text }: { text: string }) {
  return <p className="border-t border-slate-100 p-4 text-sm text-slate-500">{text}</p>;
}

function labelise(value: string) {
  return value.replaceAll("_", " ").replace(/^\w/, (match) => match.toUpperCase());
}

function toDateInput(value: string) {
  return value.slice(0, 10);
}

const selectClass =
  "h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm shadow-sm disabled:cursor-not-allowed disabled:opacity-50";
