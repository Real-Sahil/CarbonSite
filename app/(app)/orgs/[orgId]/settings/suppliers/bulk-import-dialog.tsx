"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, AlertCircle } from "lucide-react";
import { BulkImportPreview } from "./bulk-import-preview";
import { useParams } from "next/navigation";

interface BulkImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete?: () => void;
}

export function BulkImportDialog({ open, onOpenChange, onImportComplete }: BulkImportDialogProps) {
  const params = useParams();
  const orgId = params.orgId as string;

  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ success: number; failed: number; errors?: { rowNumber: number; data: Record<string, unknown>; errors: string[] }[]; message: string } | null>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const droppedFile = files[0];
      if (droppedFile.name.endsWith(".csv")) {
        setFile(droppedFile);
        setError(null);
      } else {
        setError("Please drop a CSV file");
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.name.endsWith(".csv")) {
        setFile(selectedFile);
        setError(null);
      } else {
        setError("Please select a CSV file");
      }
    }
  };

  const handleImport = async () => {
    if (!file) return;

    setIsProcessing(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`/api/orgs/${orgId}/supplier-accounts/bulk`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || "Import failed");
        setResult(data);
      } else {
        setResult(data);
        if (data.success > 0) {
          // Show success preview instead of immediately closing
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    if (!isProcessing) {
      setFile(null);
      setError(null);
      setResult(null);
      onOpenChange(false);
    }
  };

  const handleConfirmSuccess = () => {
    onImportComplete?.();
    handleClose();
  };

  if (result) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-4xl max-h-96 overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import Results</DialogTitle>
          </DialogHeader>
          <BulkImportPreview result={result} />
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={handleClose}>
              Close
            </Button>
            {result.success > 0 && (
              <Button onClick={handleConfirmSuccess}>
                Done
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Import Supplier Accounts</DialogTitle>
          <DialogDescription>Upload a CSV file to create multiple supplier accounts at once</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
              isDragging
                ? "border-blue-500 bg-blue-50"
                : "border-gray-300 hover:border-gray-400"
            }`}
          >
            <Upload className="w-8 h-8 mx-auto mb-2 text-gray-500" />
            <p className="text-sm font-medium text-gray-700 mb-1">
              Drag and drop your CSV file here
            </p>
            <p className="text-xs text-gray-500">or</p>
            <label>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="hidden"
              />
              <span className="text-sm text-blue-600 hover:text-blue-700 cursor-pointer underline">
                Click to browse
              </span>
            </label>
          </div>

          {file && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm font-medium text-gray-700">Selected file:</p>
              <p className="text-sm text-gray-600">{file.name}</p>
              <p className="text-xs text-gray-500 mt-1">{(file.size / 1024).toFixed(2)} KB</p>
            </div>
          )}

          <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
            <p className="text-xs font-medium text-gray-600 mb-2">CSV Format:</p>
            <code className="text-xs text-gray-600 block whitespace-pre-wrap break-words">
              {`email,name,company,tags,categoryAssignments
supplier@example.com,John Smith,Acme Corp,partner;uk,s2-electricity-lb
supplier2@example.com,Jane Doe,Supplier Ltd,,s1-stationary;s3-purchased-goods`}
            </code>
            <p className="text-xs text-gray-500 mt-2">
              • email & name are required
              • company is optional
              • tags: comma-separated
              • categoryAssignments: semicolon-separated (e.g., s1-stationary;s2-electricity-lb)
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleClose} disabled={isProcessing}>
              Cancel
            </Button>
            <Button onClick={handleImport} disabled={!file || isProcessing}>
              {isProcessing ? "Importing..." : "Import"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
