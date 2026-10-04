"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormActions, FormDisclosure, FormError, FormField, FormSection } from "@/components/forms/form-kit";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const FONT_OPTIONS = [
  { value: "Inter", label: "Inter" },
  { value: "Roboto", label: "Roboto" },
  { value: "Open Sans", label: "Open Sans" },
  { value: "Lato", label: "Lato" },
  { value: "Montserrat", label: "Montserrat" },
];

interface UpsertBrandingFormProps {
  orgId: string;
  current: {
    subdomain: string | null;
    primaryHex: string | null;
    accentHex: string | null;
    emailFromName: string | null;
    fontFamily: string | null;
    customDomain: string | null;
    reportHeaderLogoKey: string | null;
  } | null;
  logoPreviewUrl: string | null;
}

export function UpsertBrandingForm({ orgId, current, logoPreviewUrl }: UpsertBrandingFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [subdomain, setSubdomain] = useState(current?.subdomain ?? "");
  const [primaryHex, setPrimaryHex] = useState(current?.primaryHex ?? "#0f4c8a");
  const [accentHex, setAccentHex] = useState(current?.accentHex ?? "#e8f0fe");
  const [emailFromName, setEmailFromName] = useState(current?.emailFromName ?? "");
  const [fontFamily, setFontFamily] = useState(current?.fontFamily ?? "Inter");
  const [customDomain, setCustomDomain] = useState(current?.customDomain ?? "");

  const [logoKey, setLogoKey] = useState(current?.reportHeaderLogoKey ?? "");
  const [logoPreview, setLogoPreview] = useState(logoPreviewUrl ?? "");
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSuccessMessage(null);
    setErrorMessage(null);
    setUploadingLogo(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/orgs/${orgId}/branding/logo`, {
        method: "POST",
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorMessage((data as { message?: string }).message ?? "Logo upload failed.");
        return;
      }
      setLogoKey(data.key as string);
      setLogoPreview(data.url as string);
      setSuccessMessage("Logo uploaded — click Save branding to apply it.");
    } catch {
      setErrorMessage("Logo upload failed. Please try again.");
    } finally {
      setUploadingLogo(false);
    }
  }

  function handleRemoveLogo() {
    setLogoKey("");
    setLogoPreview("");
    setSuccessMessage(null);
    setErrorMessage(null);
  }

  function handlePrimaryHexChange(value: string) {
    setPrimaryHex(value);
    setSuccessMessage(null);
    setErrorMessage(null);
  }

  function handleAccentHexChange(value: string) {
    setAccentHex(value);
    setSuccessMessage(null);
    setErrorMessage(null);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSuccessMessage(null);
    setErrorMessage(null);

    startTransition(async () => {
      try {
        const res = await fetch(`/api/orgs/${orgId}/branding`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subdomain: subdomain || undefined,
            primaryHex,
            accentHex,
            emailFromName: emailFromName || undefined,
            fontFamily,
            customDomain: customDomain || undefined,
            reportHeaderLogoKey: logoKey,
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setErrorMessage(
            (data as { message?: string }).message ?? "Failed to save branding. Please try again.",
          );
          return;
        }

        setSuccessMessage("Branding saved");
        router.refresh();
      } catch {
        setErrorMessage("An unexpected error occurred. Please try again.");
      }
    });
  }

  const subdomainPreview = subdomain
    ? `https://${subdomain}.metricora.co.uk`
    : null;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Report logo (white-label) */}
      <FormSection title="Report logo" description="Appears on every PDF export." cols={2}>
        <div className="flex items-center gap-4 @md:col-span-full">
          <div className="flex h-16 w-32 items-center justify-center rounded-[10px] border border-dashed border-slate-200 bg-slate-50 overflow-hidden shrink-0">
            {logoPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoPreview}
                alt="Report logo preview"
                className="max-h-14 max-w-[120px] object-contain"
              />
            ) : (
              <span className="text-xs text-slate-500">No logo</span>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <input
              id="logo-upload"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              onChange={handleLogoChange}
              disabled={uploadingLogo || isPending}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => document.getElementById("logo-upload")?.click()}
              disabled={uploadingLogo || isPending}
              className="px-3 py-1.5 rounded-md border border-slate-200 bg-slate-50 text-sm font-medium text-slate-900 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed w-fit transition-colors"
            >
              {uploadingLogo ? "Uploading…" : "Choose File"}
            </button>
            {logoPreview && !uploadingLogo && (
              <button
                type="button"
                onClick={handleRemoveLogo}
                className="text-xs text-red-400 hover:underline w-fit"
              >
                Remove logo
              </button>
            )}
            <p className="text-xs text-slate-500 tracking-[-0.36px]">
              PNG, JPEG, WEBP or SVG · up to 2 MB. A transparent PNG looks best.
            </p>
          </div>
        </div>
      </FormSection>

      {/* Colour and type */}
      <FormSection title="Colour and type" cols={2}>
      {/* Primary colour */}
      <FormField label="Primary colour" htmlFor="primaryHex">
        <div className="flex items-center gap-3">
          <div
            className="h-9 w-9 rounded-[7px] border border-slate-200 shrink-0"
            style={{ backgroundColor: primaryHex }}
            aria-hidden="true"
          />
          <input
            type="color"
            value={primaryHex}
            onChange={(e) => handlePrimaryHexChange(e.target.value)}
            className="h-9 w-9 cursor-pointer rounded-[7px] border border-slate-200 bg-transparent p-0"
            aria-label="Primary colour picker"
          />
          <Input
            id="primaryHex"
            value={primaryHex}
            onChange={(e) => handlePrimaryHexChange(e.target.value)}
            placeholder="#0f4c8a"
            className="max-w-[140px] font-mono text-sm"
            maxLength={7}
          />
        </div>
      </FormField>

      {/* Accent colour */}
      <FormField label="Accent colour" htmlFor="accentHex">
        <div className="flex items-center gap-3">
          <div
            className="h-9 w-9 rounded-[7px] border border-slate-200 shrink-0"
            style={{ backgroundColor: accentHex }}
            aria-hidden="true"
          />
          <input
            type="color"
            value={accentHex}
            onChange={(e) => handleAccentHexChange(e.target.value)}
            className="h-9 w-9 cursor-pointer rounded-[7px] border border-slate-200 bg-transparent p-0"
            aria-label="Accent colour picker"
          />
          <Input
            id="accentHex"
            value={accentHex}
            onChange={(e) => handleAccentHexChange(e.target.value)}
            placeholder="#e8f0fe"
            className="max-w-[140px] font-mono text-sm"
            maxLength={7}
          />
        </div>
      </FormField>

      {/* Font family */}
      <FormField label="Font family" htmlFor="fontFamily">
        <Select
          value={fontFamily}
          onValueChange={(value) => {
            setFontFamily(value);
            setSuccessMessage(null);
            setErrorMessage(null);
          }}
        >
          <SelectTrigger id="fontFamily" className="w-full">
            <SelectValue placeholder="Select font" />
          </SelectTrigger>
          <SelectContent>
            {FONT_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormField>

      </FormSection>

      <FormSection title="Web address and email" cols={2}>
      <FormField label="Subdomain" htmlFor="subdomain" hint={subdomainPreview ? `Preview URL: ${subdomainPreview}` : undefined}>
        <Input
          id="subdomain"
          value={subdomain}
          onChange={(e) => {
            setSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
            setSuccessMessage(null);
            setErrorMessage(null);
          }}
          placeholder="your-company"
          pattern="[a-z0-9-]+"
        />
      </FormField>

      {/* Email from name */}
      <FormField label="Email from name" htmlFor="emailFromName" optional hint="The sender name on emails MetricOra sends for you">
        <Input
          id="emailFromName"
          value={emailFromName}
          onChange={(e) => {
            setEmailFromName(e.target.value);
            setSuccessMessage(null);
            setErrorMessage(null);
          }}
          placeholder="Acme Carbon"
        />
      </FormField>

      </FormSection>

      <FormDisclosure title="Custom domain">
        <FormField label="Custom domain" htmlFor="customDomain" span={2} optional hint="Point your DNS CNAME to cname.metricora.co.uk, then enter your domain here.">
          <Input
            id="customDomain"
            value={customDomain}
            onChange={(e) => {
              setCustomDomain(e.target.value);
              setSuccessMessage(null);
              setErrorMessage(null);
            }}
            placeholder="carbon.yourcompany.com"
          />
        </FormField>
      </FormDisclosure>

      {successMessage && <p role="status" className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{successMessage}</p>}
      <FormError>{errorMessage}</FormError>
      <FormActions>
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "Saving..." : "Save branding"}
        </Button>
      </FormActions>
    </form>
  );
}
