import type { KycSubmissionRow } from "../db/schema.js";
import { maskSensitiveIdentifier } from "./encryption.js";

export function sanitizeKycSubmission(submission: KycSubmissionRow) {
  const data = { ...submission.data };

  if (typeof data.bvn === "string") {
    data.bvn = maskSensitiveIdentifier(data.bvn);
  }

  if (typeof data.nin === "string") {
    data.nin = maskSensitiveIdentifier(data.nin);
  }

  return {
    id: submission.id,
    type: submission.type,
    status: submission.status,
    data,
    verifiedAt: submission.verifiedAt?.toISOString(),
    rejectedReason: submission.rejectedReason ?? undefined,
    createdAt: submission.createdAt.toISOString(),
    updatedAt: submission.updatedAt.toISOString(),
  };
}
