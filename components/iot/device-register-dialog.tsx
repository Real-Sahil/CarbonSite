"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Copy, CheckCircle2 } from "lucide-react";

interface DeviceRegisterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
  facilities: Array<{ id: string; name: string }>;
  onSuccess?: () => void;
}

interface CredentialResult {
  credentialId: string;
  apiKey: string;
  prefix: string;
  expiresAt: string;
}

export function DeviceRegisterDialog({
  open,
  onOpenChange,
  orgId,
  facilities,
  onSuccess,
}: DeviceRegisterDialogProps) {
  const [step, setStep] = useState<"form" | "credential">("form");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [credential, setCredential] = useState<CredentialResult | null>(null);
  const [copied, setCopied] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    deviceType: "",
    serialNumber: "",
    facilityId: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch(`/api/orgs/${orgId}/iot-devices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          deviceType: formData.deviceType,
          serialNumber: formData.serialNumber,
          facilityId: formData.facilityId || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Failed to register device");
      }

      const data = await response.json();
      setCredential(data.credential);
      setStep("credential");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    if (step === "credential") {
      setStep("form");
      setFormData({ name: "", deviceType: "", serialNumber: "", facilityId: "" });
      setCredential(null);
      onSuccess?.();
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {step === "form" ? "Register IoT Device" : "API Credentials"}
          </DialogTitle>
          <DialogDescription>
            {step === "form"
              ? "Configure a new meter or sensor"
              : "Save your API key securely. You won't see it again."}
          </DialogDescription>
        </DialogHeader>

        {step === "form" ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div>
              <Label htmlFor="name">Device Name</Label>
              <Input
                id="name"
                placeholder="e.g., Main Building Electricity"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                required
              />
            </div>

            <div>
              <Label htmlFor="deviceType">Device Type</Label>
              <Select
                value={formData.deviceType}
                onValueChange={(value) =>
                  setFormData({ ...formData, deviceType: value })
                }
              >
                <SelectTrigger id="deviceType">
                  <SelectValue placeholder="Select device type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="electricity_meter">
                    Electricity Meter
                  </SelectItem>
                  <SelectItem value="gas_meter">Gas Meter</SelectItem>
                  <SelectItem value="fuel_pump">Fuel Pump</SelectItem>
                  <SelectItem value="water_meter">Water Meter</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="serialNumber">Serial Number</Label>
              <Input
                id="serialNumber"
                placeholder="Device serial number or ID"
                value={formData.serialNumber}
                onChange={(e) =>
                  setFormData({ ...formData, serialNumber: e.target.value })
                }
                required
              />
            </div>

            <div>
              <Label htmlFor="facilityId">Facility (Optional)</Label>
              <Select
                value={formData.facilityId}
                onValueChange={(value) =>
                  setFormData({ ...formData, facilityId: value })
                }
              >
                <SelectTrigger id="facilityId">
                  <SelectValue placeholder="Select facility" />
                </SelectTrigger>
                <SelectContent>
                  {facilities.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Creating..." : "Register Device"}
            </Button>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg bg-green-50 p-3">
              <div className="flex items-center gap-2 text-sm font-medium text-green-900">
                <CheckCircle2 className="h-4 w-4" />
                Device registered successfully
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">API Key</Label>
              <div className="relative">
                <code className="block w-full break-all rounded bg-gray-100 px-3 py-2 font-mono text-sm">
                  {credential?.apiKey}
                </code>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1"
                  onClick={() => copyToClipboard(credential?.apiKey || "")}
                >
                  {copied ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-gray-600">
                Store this securely. You won't be able to see it again.
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Expires At</Label>
              <p className="text-sm">
                {new Date(credential?.expiresAt || "").toLocaleDateString()}
              </p>
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Use this API key in your device's webhook configuration with a
                Bearer token in the Authorization header.
              </AlertDescription>
            </Alert>

            <Button onClick={handleClose} className="w-full">
              Done
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
