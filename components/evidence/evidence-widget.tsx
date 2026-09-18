"use client";

import { useCallback, useState } from "react";
import { Upload, X, AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EvidenceFile {
  id: string;
  fileName: string;
  fileSizeBytes: number;
  virusScanStatus: "pending" | "clean" | "infected" | "skipped";
  createdAt: string;
}

interface EvidenceWidgetProps {
  orgId: string;
  recordId: string;
  files: EvidenceFile[];
  isEditor: boolean;
  isAdmin: boolean;
  onUploadComplete?: () => void;
}

const ALLOWED_MIMES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
  "text/plain",
];

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}

function getVirusScanBadge(status: EvidenceFile["virusScanStatus"]) {
  switch (status) {
    case "clean":
      return (
        <div className="flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-1 rounded">
          <CheckCircle2 className="h-3 w-3" />
          Safe
        </div>
      );
    case "infected":
      return (
        <div className="flex items-center gap-1 text-xs text-red-700 bg-red-50 px-2 py-1 rounded">
          <AlertCircle className="h-3 w-3" />
          Malware detected
        </div>
      );
    case "pending":
      return (
        <div className="flex items-center gap-1 text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded">
          <Clock className="h-3 w-3" />
          Scanning…
        </div>
      );
    case "skipped":
      return (
        <div className="flex items-center gap-1 text-xs text-gray-600 bg-gray-50 px-2 py-1 rounded">
          <Clock className="h-3 w-3" />
          Not scanned
        </div>
      );
  }
}

export function EvidenceWidget({
  orgId,
  recordId,
  files,
  isEditor,
  isAdmin,
  onUploadComplete,
}: EvidenceWidgetProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const validateFile = (file: File): string | null => {
    if (!ALLOWED_MIMES.includes(file.type)) {
      return `File type ${file.type} not allowed. Supported: PDF, images, Office docs, CSV.`;
    }
    if (file.size > MAX_FILE_SIZE) {
      return `File too large. Maximum: ${formatFileSize(MAX_FILE_SIZE)}.`;
    }
    return null;
  };

  const handleUpload = useCallback(
    async (file: File) => {
      const validationError = validateFile(file);
      if (validationError) {
        setError(validationError);
        return;
      }

      setUploading(true);
      setError(null);
      setUploadProgress(0);

      try {
        const formData = new FormData();
        formData.append("file", file);

        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) {
            setUploadProgress(Math.round((e.loaded / e.total) * 100));
          }
        });

        xhr.addEventListener("load", async () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            setUploadProgress(0);
            onUploadComplete?.();
          } else {
            const data = JSON.parse(xhr.responseText);
            setError(data.message || "Upload failed.");
          }
          setUploading(false);
        });

        xhr.addEventListener("error", () => {
          setError("Network error.");
          setUploading(false);
        });

        xhr.addEventListener("abort", () => {
          setError("Upload cancelled.");
          setUploading(false);
        });

        xhr.open(
          "POST",
          `/api/orgs/${orgId}/activity-records/${recordId}/evidence`
        );
        xhr.send(formData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed.");
        setUploading(false);
      }
    },
    [orgId, recordId, onUploadComplete]
  );

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
  };

  const handleDrag = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === "dragenter" || e.type === "dragover");
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const file = e.dataTransfer.files?.[0];
    if (file) handleUpload(file);
  };

  const handleDelete = async (fileId: string) => {
    if (!window.confirm("Delete this evidence file?")) return;

    try {
      const res = await fetch(
        `/api/orgs/${orgId}/activity-records/${recordId}/evidence?fileId=${fileId}`,
        { method: "DELETE" }
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.message ?? "Delete failed.");
      } else {
        onUploadComplete?.();
      }
    } catch {
      setError("Network error.");
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-2 border rounded-lg p-3 bg-white">
          <p className="text-sm font-medium text-gray-900">
            Attached Files ({files.length})
          </p>
          {files.map((file) => (
            <div
              key={file.id}
              className="flex items-center justify-between gap-3 p-2 rounded border border-gray-200"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {file.fileName}
                </p>
                <p className="text-xs text-gray-500">
                  {formatFileSize(file.fileSizeBytes)} •{" "}
                  {new Date(file.createdAt).toLocaleDateString()}
                </p>
              </div>

              <div className="flex items-center gap-2">
                {getVirusScanBadge(file.virusScanStatus)}
                {isAdmin && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(file.id)}
                    className="h-8 w-8 p-0 text-gray-500 hover:text-red-600"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Area */}
      {isEditor && (
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
            dragActive
              ? "border-blue-400 bg-blue-50"
              : "border-gray-300 hover:border-gray-400 bg-gray-50"
          } ${uploading ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          <div className="flex flex-col items-center gap-2">
            {uploadProgress > 0 && uploadProgress < 100 ? (
              <>
                <div className="text-sm font-medium text-gray-700">
                  Uploading… {uploadProgress}%
                </div>
                <div className="w-32 bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </>
            ) : (
              <>
                <Upload className="h-8 w-8 text-gray-400" />
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    Drag files here or{" "}
                    <label className="text-blue-600 hover:underline cursor-pointer">
                      browse
                      <input
                        type="file"
                        className="sr-only"
                        onChange={handleFileInput}
                        disabled={uploading}
                        accept={ALLOWED_MIMES.join(",")}
                      />
                    </label>
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    PDF, images, Office docs, CSV (max{" "}
                    {formatFileSize(MAX_FILE_SIZE)})
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
          <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}
    </div>
  );
}
