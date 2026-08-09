"use client";

import { ExternalLink } from "lucide-react";

interface SubmissionEvidenceDownloadsProps {
  orgId: string;
  files: { id: string; filename: string }[];
}

export function SubmissionEvidenceDownloads({ orgId, files }: SubmissionEvidenceDownloadsProps) {
  return (
    <div className="divide-y divide-[#e5e7eb] rounded-[14px] border border-[#E5E7EB]">
      {files.map((file) => (
        <a
          key={file.id}
          href={`/api/orgs/${orgId}/evidence/${file.id}/download`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-[#F0F9FF] transition-colors"
        >
          <span className="text-sm text-[#111827] tracking-[-0.42px]">{file.filename}</span>
          <ExternalLink aria-hidden="true" className="h-4 w-4 shrink-0 text-[#374151]" />
        </a>
      ))}
    </div>
  );
}
