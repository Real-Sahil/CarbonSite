"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useSafeMutation } from "@/lib/hooks/use-safe-mutation";
import { SubmissionReviewActions } from "../review-actions";
import { Edit2, Save, X } from "lucide-react";

interface SubmissionDetailProps {
  submission: any;
  emissionCategories: { id: string; name: string; scope: number }[];
  facilities: { id: string; name: string }[];
  orgId: string;
}

export function SubmissionDetail({
  submission,
  emissionCategories,
  facilities,
  orgId,
}: SubmissionDetailProps) {
  const router = useRouter();
  const { execute } = useSafeMutation();
  const [isEditing, setIsEditing] = useState(false);
  const [editedOcrData, setEditedOcrData] = useState(
    submission.ocrExtractedData ? JSON.stringify(submission.ocrExtractedData, null, 2) : ""
  );
  const [editedFormData, setEditedFormData] = useState(
    submission.formData ? JSON.stringify(submission.formData, null, 2) : ""
  );
  const [isSaving, setIsSaving] = useState(false);

  async function handleSaveEdits() {
    setIsSaving(true);
    try {
      const ocrData = editedOcrData ? JSON.parse(editedOcrData) : null;
      const formData = editedFormData ? JSON.parse(editedFormData) : {};

      const result = await execute(async () => {
        const res = await fetch(
          `/api/orgs/${orgId}/field-submissions/${submission.id}/review`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: submission.status,
              ocrExtractedData: ocrData,
              formData: formData,
            }),
          }
        );

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.message ?? "Failed to save edits.");
        }

        return res.json();
      });

      if (result.success) {
        setIsEditing(false);
        router.refresh();
      }
    } catch (err) {
      console.error("Failed to save edits:", err);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="grid gap-6">
      {/* OCR Extracted Data Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Parsed data</CardTitle>
              <CardDescription>
                Data extracted by OCR from the submitted document
              </CardDescription>
            </div>
            {!isEditing && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsEditing(true)}
                className="gap-1.5"
              >
                <Edit2 className="h-4 w-4" />
                Edit
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isEditing ? (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-[#374151] mb-1 block">
                  OCR extracted data (JSON)
                </label>
                <Textarea
                  value={editedOcrData}
                  onChange={(e) => setEditedOcrData(e.target.value)}
                  className="font-mono text-xs"
                  rows={6}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-[#374151] mb-1 block">
                  Form data (JSON)
                </label>
                <Textarea
                  value={editedFormData}
                  onChange={(e) => setEditedFormData(e.target.value)}
                  className="font-mono text-xs"
                  rows={6}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setIsEditing(false);
                    setEditedOcrData(
                      submission.ocrExtractedData
                        ? JSON.stringify(submission.ocrExtractedData, null, 2)
                        : ""
                    );
                    setEditedFormData(
                      submission.formData
                        ? JSON.stringify(submission.formData, null, 2)
                        : ""
                    );
                  }}
                  disabled={isSaving}
                  className="gap-1.5"
                >
                  <X className="h-4 w-4" />
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveEdits}
                  disabled={isSaving}
                  className="gap-1.5"
                >
                  <Save className="h-4 w-4" />
                  {isSaving ? "Saving…" : "Save changes"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-medium text-[#374151] mb-2">OCR extracted</h4>
                <pre className="bg-[#F9FAFB] p-3 rounded-lg text-xs overflow-auto max-h-48 border border-[#E5E7EB]">
                  {submission.ocrExtractedData
                    ? JSON.stringify(submission.ocrExtractedData, null, 2)
                    : "(No data extracted)"}
                </pre>
              </div>
              <div>
                <h4 className="text-xs font-medium text-[#374151] mb-2">Form data</h4>
                <pre className="bg-[#F9FAFB] p-3 rounded-lg text-xs overflow-auto max-h-48 border border-[#E5E7EB]">
                  {submission.formData
                    ? JSON.stringify(submission.formData, null, 2)
                    : "(No form data)"}
                </pre>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Submission Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Submission details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-[#374151] mb-1">Submitted by</p>
              <p className="text-sm font-medium text-[#111827]">
                {submission.submittedBy.name ?? submission.submittedBy.email}
              </p>
            </div>
            <div>
              <p className="text-xs text-[#374151] mb-1">Reporting period</p>
              <p className="text-sm font-medium text-[#111827]">
                {submission.reportingPeriod.label}
              </p>
            </div>
            <div>
              <p className="text-xs text-[#374151] mb-1">Submitted at</p>
              <p className="text-sm font-medium text-[#111827]">
                {new Date(submission.createdAt).toLocaleString("en-GB")}
              </p>
            </div>
            <div>
              <p className="text-xs text-[#374151] mb-1">Status</p>
              <p className="text-sm font-medium text-[#111827]">
                {submission.status.replace(/_/g, " ")}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Review Actions */}
      <SubmissionReviewActions
        orgId={orgId}
        submissionId={submission.id}
        currentEmissionCategoryId={submission.emissionCategoryId}
        currentFacilityId={submission.facilityId}
        emissionCategories={emissionCategories}
        facilities={facilities}
        disabled={isEditing}
      />
    </div>
  );
}
