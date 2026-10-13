import type { Prisma } from "@prisma/client";

// Evidence a field worker may link to a submission: files they uploaded, or
// files already on one of their own submissions (a resubmission). Other files
// in the organisation are not theirs to attach.
export function workerEvidenceWhere(userId: string): Prisma.EvidenceFileWhereInput {
  return {
    OR: [
      { uploadedByUserId: userId },
      { submissionFiles: { some: { fieldSubmission: { submittedByUserId: userId } } } },
    ],
  };
}
