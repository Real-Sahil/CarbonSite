"use client";

import { useState } from "react";
import { Mail, Send, CheckCircle, Loader } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type InviteMethod = "magic-link" | "credentials";

interface SupplierInviteFormProps {
  orgId: string;
}

export function SupplierInviteForm({ orgId }: SupplierInviteFormProps) {
  const [inviteMethod, setInviteMethod] = useState<InviteMethod>("magic-link");
  const [autoGenPassword, setAutoGenPassword] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    email: "",
    companyName: "",
    category: "",
    password: "",
  });

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { id, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [id.replace("supplier-", "")]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(
        `/api/orgs/${orgId}/supplier-invites`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: formData.email,
            companyName: formData.companyName || undefined,
            inviteMethod,
            expiresInDays: 7,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to send invitation");
      }

      const data = await response.json();

      if (inviteMethod === "magic-link") {
        setSuccessMessage(
          `Magic link invitation sent to ${formData.email}. They can accept using the secure link in their email.`
        );
      } else {
        setSuccessMessage(
          `Account created for ${formData.email}. Temporary password sent via email. They'll be prompted to change it on first login.`
        );
      }

      // Reset form
      setFormData({ email: "", companyName: "", category: "", password: "" });
      setAutoGenPassword(true);

      // Clear success message after 5 seconds
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "An error occurred"
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="border-[#E5E7EB] bg-white shadow-sm">
      <CardHeader>
        <CardTitle className="text-slate-900 flex items-center gap-2">
          <Mail className="h-5 w-5 text-[#f97316]" />
          Send Supplier Invitation
        </CardTitle>
        <CardDescription>
          Invite suppliers to submit emissions data
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Success Message */}
        {successMessage && (
          <div className="flex gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
            <CheckCircle className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-emerald-800">{successMessage}</p>
          </div>
        )}

        {/* Error Message */}
        {errorMessage && (
          <div className="flex gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">{errorMessage}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Invite Method Selection */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-slate-900">
              Invitation Method
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setInviteMethod("magic-link")}
                className={`p-4 rounded-lg border-2 transition-all text-left ${
                  inviteMethod === "magic-link"
                    ? "border-[#f97316] bg-[#fff7ed]"
                    : "border-[#E5E7EB] bg-white hover:border-slate-300"
                }`}
              >
                <div className="font-medium text-slate-900">Magic Link</div>
                <div className="text-xs text-slate-500 mt-1">
                  No account needed, one-time use
                </div>
              </button>
              <button
                type="button"
                onClick={() => setInviteMethod("credentials")}
                className={`p-4 rounded-lg border-2 transition-all text-left ${
                  inviteMethod === "credentials"
                    ? "border-[#f97316] bg-[#fff7ed]"
                    : "border-[#E5E7EB] bg-white hover:border-slate-300"
                }`}
              >
                <div className="font-medium text-slate-900">Create Account</div>
                <div className="text-xs text-slate-500 mt-1">
                  Persistent login credentials
                </div>
              </button>
            </div>
          </div>

          {/* Email Input */}
          <div>
            <label htmlFor="supplier-email" className="block text-sm font-medium text-slate-900 mb-2">
              Supplier Email Address
            </label>
            <input
              id="supplier-email"
              type="email"
              placeholder="contact@supplier.com"
              value={formData.email}
              onChange={handleInputChange}
              required
              className="w-full px-4 py-2 bg-white border border-[#E5E7EB] rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#f97316]"
            />
          </div>

          {/* Company Name Input */}
          <div>
            <label htmlFor="supplier-companyName" className="block text-sm font-medium text-slate-900 mb-2">
              Supplier Company Name
            </label>
            <input
              id="supplier-companyName"
              type="text"
              placeholder="e.g., Acme Supply Co."
              value={formData.companyName}
              onChange={handleInputChange}
              className="w-full px-4 py-2 bg-white border border-[#E5E7EB] rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#f97316]"
            />
          </div>

          {/* Category Select */}
          <div>
            <label htmlFor="supplier-category" className="block text-sm font-medium text-slate-900 mb-2">
              Category (Optional)
            </label>
            <select
              id="supplier-category"
              value={formData.category}
              onChange={handleInputChange}
              className="w-full px-4 py-2 bg-white border border-[#E5E7EB] rounded-lg text-slate-900 focus:outline-none focus:border-[#f97316]"
            >
              <option value="">Select category</option>
              <option value="logistics">Logistics & Transport</option>
              <option value="raw-materials">Raw Materials</option>
              <option value="packaging">Packaging</option>
              <option value="subcontractors">Subcontractors</option>
              <option value="services">Professional Services</option>
              <option value="facilities">Facilities & Utilities</option>
              <option value="other">Other</option>
            </select>
          </div>

          {/* Credentials Method Password Info */}
          {inviteMethod === "credentials" && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-2">Password will be auto-generated and sent via email</p>
                <p className="text-xs">The supplier will be prompted to change their password on first login.</p>
              </div>
            </div>
          )}

          {/* Magic Link Method Info */}
          {inviteMethod === "magic-link" && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
              <div className="text-sm text-emerald-800">
                <p className="font-medium mb-2">Magic link expires in 7 days</p>
                <p className="text-xs">No account needed. Supplier opens link to submit data directly.</p>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={isLoading}
            className="w-full bg-[#f97316] hover:bg-orange-600 text-white font-semibold disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <Loader className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send Invitation
              </>
            )}
          </Button>
        </form>

        {/* Info Section */}
        <div className="border-t border-[#E5E7EB] pt-6">
          <h4 className="font-semibold text-slate-900 mb-3">Comparison:</h4>
          <div className="grid gap-4 text-sm">
            <div>
              <div className="font-medium text-[#f97316] mb-1">Magic Link</div>
              <ul className="space-y-1 text-slate-600 text-xs">
                <li>✓ No account creation required</li>
                <li>✓ Faster onboarding</li>
                <li>✓ Expires after 7 days</li>
                <li>✗ Can only be used once</li>
              </ul>
            </div>
            <div>
              <div className="font-medium text-[#f97316] mb-1">Create Account</div>
              <ul className="space-y-1 text-slate-600 text-xs">
                <li>✓ Persistent login access</li>
                <li>✓ Can return to view submissions</li>
                <li>✓ Better for ongoing relationships</li>
                <li>✗ Requires password change on first login</li>
              </ul>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
