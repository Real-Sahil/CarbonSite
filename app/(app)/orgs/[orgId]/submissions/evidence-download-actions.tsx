"use client";

import { ExternalLink } from "lucide-react";

interface SubmissionEvidenceDownloadsProps {
  orgId: string;
  files: { id: string; filename: string }[];
}

export function SubmissionEvidenceDownloads({ orgId, files }: SubmissionEvidenceDownloadsProps) {
  return (
    <div className="divide-y divide-[#e5e7eb] rounded-[14px] border border-[#e5e7eb]">
      {files.map((file) => (
        <a
          key={file.id}
          href={`/api/orgs/${orgId}/evidence/${file.id}/download`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-[#e1f4df] transition-colors"
        >
          <span className="text-sm text-[#0f3e17] tracking-[-0.42px]">{file.filename}</span>
          <ExternalLink aria-hidden="true" className="h-4 w-4 shrink-0 text-[#333333]" />
        </a>
      ))}
    </div>
  );
}
