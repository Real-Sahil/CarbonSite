"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  const [showAdvanced, setShowAdvanced] = useState(false);

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
    ? `https://${subdomain}.carbonsite.app`
    : null;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {/* Report logo (white-label) */}
      <div className="flex flex-col gap-2">
        <Label className="text-sm text-[#111827] tracking-[-0.42px]">
          Report logo{" "}
          <span className="text-[#374151] font-normal">(appears on every PDF export)</span>
        </Label>
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-32 items-center justify-center rounded-[10px] border border-dashed border-[#cbd5e1] bg-white overflow-hidden shrink-0">
            {logoPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoPreview}
                alt="Report logo preview"
                className="max-h-14 max-w-[120px] object-contain"
              />
            ) : (
              <span className="text-xs text-[#94a3b8]">No logo</span>
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
              className="px-3 py-1.5 rounded-md border border-[#E5E7EB] bg-white text-sm font-medium hover:bg-[#f8fafc] disabled:opacity-50 disabled:cursor-not-allowed w-fit"
            >
              {uploadingLogo ? "Uploading…" : "Choose File"}
            </button>
            {logoPreview && !uploadingLogo && (
              <button
                type="button"
                onClick={handleRemoveLogo}
                className="text-xs text-red-600 hover:underline w-fit"
              >
                Remove logo
              </button>
            )}
            <p className="text-xs text-[#374151] tracking-[-0.36px]">
              PNG, JPEG, WEBP or SVG · up to 2 MB. A transparent PNG looks best.
            </p>
          </div>
        </div>
      </div>

      {/* Subdomain */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="subdomain" className="text-sm text-[#111827] tracking-[-0.42px]">
          Subdomain
        </Label>
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
          className="max-w-sm"
        />
        {subdomainPreview && (
          <p className="text-xs text-[#374151] tracking-[-0.36px]">
            Preview URL:{" "}
            <span className="text-[#111827] font-normal">{subdomainPreview}</span>
          </p>
        )}
      </div>

      {/* Primary colour */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="primaryHex" className="text-sm text-[#111827] tracking-[-0.42px]">
          Primary colour
        </Label>
        <div className="flex items-center gap-3">
          <div
            className="h-9 w-9 rounded-[7px] border border-[#E5E7EB] shrink-0"
            style={{ backgroundColor: primaryHex }}
            aria-hidden="true"
          />
          <input
            type="color"
            value={primaryHex}
            onChange={(e) => handlePrimaryHexChange(e.target.value)}
            className="h-9 w-9 cursor-pointer rounded-[7px] border border-[#E5E7EB] bg-transparent p-0"
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
      </div>

      {/* Accent colour */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="accentHex" className="text-sm text-[#111827] tracking-[-0.42px]">
          Accent colour
        </Label>
        <div className="flex items-center gap-3">
          <div
            className="h-9 w-9 rounded-[7px] border border-[#E5E7EB] shrink-0"
            style={{ backgroundColor: accentHex }}
            aria-hidden="true"
          />
          <input
            type="color"
            value={accentHex}
            onChange={(e) => handleAccentHexChange(e.target.value)}
            className="h-9 w-9 cursor-pointer rounded-[7px] border border-[#E5E7EB] bg-transparent p-0"
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
      </div>

      {/* Email from name */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="emailFromName" className="text-sm text-[#111827] tracking-[-0.42px]">
          Email from name{" "}
          <span className="text-[#374151] font-normal">(optional)</span>
        </Label>
        <Input
          id="emailFromName"
          value={emailFromName}
          onChange={(e) => {
            setEmailFromName(e.target.value);
            setSuccessMessage(null);
            setErrorMessage(null);
          }}
          placeholder="Acme Carbon"
          className="max-w-sm"
        />
      </div>

      {/* Font family */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="fontFamily" className="text-sm text-[#111827] tracking-[-0.42px]">
          Font family
        </Label>
        <Select
          value={fontFamily}
          onValueChange={(value) => {
            setFontFamily(value);
            setSuccessMessage(null);
            setErrorMessage(null);
          }}
        >
          <SelectTrigger id="fontFamily" className="max-w-sm">
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
      </div>

      {/* Advanced (custom domain) */}
      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={() => setShowAdvanced((prev) => !prev)}
          className="flex items-center gap-1.5 text-xs text-[#374151] hover:text-[#111827] tracking-[-0.36px] w-fit transition-colors"
        >
          <span>{showAdvanced ? "Hide" : "Show"} advanced</span>
          <svg
            className={`h-3 w-3 transition-transform ${showAdvanced ? "rotate-180" : ""}`}
            viewBox="0 0 12 12"
            fill="none"
            aria-hidden="true"
          >
            <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {showAdvanced && (
          <div className="flex flex-col gap-2 rounded-[14px] border border-[#E5E7EB] bg-white p-4">
            <Label htmlFor="customDomain" className="text-sm text-[#111827] tracking-[-0.42px]">
              Custom domain{" "}
              <span className="text-[#374151] font-normal">(optional)</span>
            </Label>
            <Input
              id="customDomain"
              value={customDomain}
              onChange={(e) => {
                setCustomDomain(e.target.value);
                setSuccessMessage(null);
                setErrorMessage(null);
              }}
              placeholder="carbon.yourcompany.com"
              className="max-w-sm"
            />
            <p className="text-xs text-[#374151] tracking-[-0.36px]">
              Point your DNS CNAME to <code className="font-mono bg-[#F0F9FF] px-1 rounded">cname.carbonsite.app</code>, then enter your domain here.
            </p>
          </div>
        )}
      </div>

      {/* Feedback */}
      {successMessage && (
        <p className="text-sm font-normal text-[#111827] bg-[#F0F9FF] rounded-[10px] px-4 py-2.5 tracking-[-0.42px]">
          {successMessage}
        </p>
      )}
      {errorMessage && (
        <p className="text-sm font-normal text-red-700 bg-red-50 rounded-[10px] px-4 py-2.5 tracking-[-0.42px]">
          {errorMessage}
        </p>
      )}

      <div>
        <Button type="submit" disabled={isPending} className="min-w-[120px]">
          {isPending ? "Saving..." : "Save branding"}
        </Button>
      </div>
    </form>
  );
}
