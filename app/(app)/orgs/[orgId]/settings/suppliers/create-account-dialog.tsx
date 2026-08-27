"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, CheckCircle, ChevronDown } from "lucide-react";
import { TagInput } from "@/components/suppliers/tag-input";
import { CategorySelector } from "@/components/suppliers/category-selector";

interface CreateAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
  onSuccess: () => void;
}

export function CreateAccountDialog({ open, onOpenChange, orgId, onSuccess }: CreateAccountDialogProps) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [result, setResult] = useState<{ userId: string; password: string } | null>(null);

  const handleCreateTag = async (tagName: string) => {
    try {
      const res = await fetch(`/api/orgs/${orgId}/supplier-tags`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: tagName }),
      });
      if (!res.ok) {
        throw new Error("Failed to create tag");
      }
    } catch (err) {
      throw err;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email || !name) {
      setError("Email and name are required");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/sign-up/supplier", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId,
          email,
          name,
          company: company || undefined,
          tags: tags.length > 0 ? tags : undefined,
          categoryAssignments: categories.length > 0 ? categories : undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to create account");
      }

      const data = await res.json();

      // If we have tags to assign, we'd need to do that separately
      // For now, the bulk API handles it but the sign-up API doesn't
      // TODO: Extend sign-up supplier API to handle tag/category assignments

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create account");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (result) {
      setEmail("");
      setName("");
      setCompany("");
      setTags([]);
      setCategories([]);
      setShowAdvanced(false);
      setResult(null);
      onOpenChange(false);
      onSuccess();
    } else if (!loading) {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create Supplier Account</DialogTitle>
          <DialogDescription>Create a new login account for a supplier</DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-4">
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">Account created successfully!</AlertDescription>
            </Alert>

            <div className="space-y-3 rounded-lg bg-zinc-50 p-4">
              <div>
                <p className="text-xs text-zinc-600">Email</p>
                <p className="font-mono text-sm font-medium text-zinc-900">{email}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-600">Temporary Password</p>
                <div className="flex items-center gap-2">
                  <p className="flex-1 font-mono text-sm font-medium text-zinc-900">{result.password}</p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(result.password);
                    }}
                  >
                    Copy
                  </Button>
                </div>
              </div>
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Share these credentials with the supplier. They can reset their password after first login.
              </AlertDescription>
            </Alert>

            <Button onClick={handleClose} className="w-full">
              Done
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div>
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="supplier@example.com"
                required
                disabled={loading}
              />
            </div>

            <div>
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Doe"
                required
                disabled={loading}
              />
            </div>

            <div>
              <Label htmlFor="company">Company (optional)</Label>
              <Input
                id="company"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Acme Corp"
                disabled={loading}
              />
            </div>

            {/* Advanced Options */}
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
            >
              <ChevronDown className={`w-4 h-4 transition-transform ${showAdvanced ? "rotate-180" : ""}`} />
              Advanced Options
            </button>

            {showAdvanced && (
              <div className="space-y-4 pt-2 border-t">
                <div>
                  <Label className="mb-2 block">Tags (optional)</Label>
                  <TagInput
                    value={tags}
                    onChange={setTags}
                    orgId={orgId}
                    onCreateTag={handleCreateTag}
                    placeholder="Add tags..."
                  />
                  <p className="text-xs text-gray-500 mt-1">Create or select tags to organize suppliers</p>
                </div>

                <div>
                  <Label className="mb-2 block">Category Restrictions (optional)</Label>
                  <details className="text-sm">
                    <summary className="cursor-pointer text-gray-600 hover:text-gray-900 mb-2">
                      Show categories...
                    </summary>
                    <div className="mt-2 p-3 bg-gray-50 rounded border border-gray-200">
                      <CategorySelector
                        value={categories}
                        onChange={setCategories}
                        disabled={loading}
                      />
                    </div>
                  </details>
                  <p className="text-xs text-gray-500 mt-1">
                    If set, supplier can only submit data for these categories
                  </p>
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-4">
              <Button type="submit" disabled={loading} className="flex-1">
                {loading ? "Creating..." : "Create Account"}
              </Button>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                Cancel
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
