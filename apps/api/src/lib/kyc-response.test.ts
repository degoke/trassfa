import { describe, expect, it } from "vitest";
import type { KycSubmissionRow } from "../db/schema.js";
import { sanitizeKycSubmission } from "./kyc-response.js";

function createSubmission(overrides: Partial<KycSubmissionRow> = {}): KycSubmissionRow {
  return {
    id: 1,
    userId: "user_1",
    type: "bvn",
    status: "pending",
    data: { bvn: "12345678901" },
    verifiedAt: null,
    rejectedReason: null,
    createdAt: new Date("2024-01-01T10:00:00Z"),
    updatedAt: new Date("2024-01-02T10:00:00Z"),
    ...overrides,
  };
}

describe("sanitizeKycSubmission", () => {
  it("masks BVN values in API responses", () => {
    const sanitized = sanitizeKycSubmission(createSubmission());

    expect(sanitized.data.bvn).toBe("***8901");
  });

  it("masks NIN values in API responses", () => {
    const sanitized = sanitizeKycSubmission(
      createSubmission({
        type: "nin",
        data: { nin: "98765432109" },
      }),
    );

    expect(sanitized.data.nin).toBe("***2109");
  });

  it("serializes timestamps and omits null rejected reasons", () => {
    const sanitized = sanitizeKycSubmission(
      createSubmission({
        verifiedAt: new Date("2024-01-03T10:00:00Z"),
        rejectedReason: "mismatch",
      }),
    );

    expect(sanitized.verifiedAt).toBe("2024-01-03T10:00:00.000Z");
    expect(sanitized.rejectedReason).toBe("mismatch");
    expect(sanitized.createdAt).toBe("2024-01-01T10:00:00.000Z");
  });
});
