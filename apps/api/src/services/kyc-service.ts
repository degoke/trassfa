import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import {
  customerProfileTable,
  kycSubmissionsTable,
  permanentAccountTable,
  permanentAddressTable,
  type CustomerProfileRow
} from "../db/schema.js";
import type { CustomerLevel, KycStatus } from "../lib/domain.js";

export class KycService {

  async submitBvnVerification(userId: string, bvn: string) {
    const inserted = await db
      .insert(kycSubmissionsTable)
      .values({
        userId,
        type: "bvn",
        status: "pending",
        data: { bvn }
      })
      .returning();

    return inserted[0];
  }

  async submitNinVerification(userId: string, nin: string) {
    const inserted = await db
      .insert(kycSubmissionsTable)
      .values({
        userId,
        type: "nin",
        status: "pending",
        data: { nin }
      })
      .returning();

    return inserted[0];
  }

  async submitAddressVerification(
    userId: string,
    address: string,
    city: string,
    state: string
  ) {
    const inserted = await db
      .insert(kycSubmissionsTable)
      .values({
        userId,
        type: "address",
        status: "pending",
        data: { address, city, state }
      })
      .returning();

    return inserted[0];
  }

  async verifyPhone(userId: string) {
    await db
      .update(customerProfileTable)
      .set({ phoneVerified: true, updatedAt: new Date() })
      .where(eq(customerProfileTable.userId, userId));
  }

  async verifySubmission(
    submissionId: number,
    status: Extract<KycStatus, "verified" | "rejected">,
    rejectedReason?: string
  ) {
    const updated = await db
      .update(kycSubmissionsTable)
      .set({
        status,
        verifiedAt: status === "verified" ? new Date() : null,
        rejectedReason: rejectedReason ?? null,
        updatedAt: new Date()
      })
      .where(eq(kycSubmissionsTable.id, submissionId))
      .returning();

    if (updated.length === 0) {
      throw new Error(`KYC submission ${submissionId} not found`);
    }

    const submission = updated[0]!;
    const profile = await db.query.customerProfileTable.findFirst({
      where: eq(customerProfileTable.userId, submission.userId)
    });

    if (!profile) {
      throw new Error(`Customer profile not found for user ${submission.userId}`);
    }

    if (status === "verified") {
      await this.applyVerification(submission.userId, submission.type, profile, submission.data);
    }

    return submission;
  }

  private async applyVerification(
    userId: string,
    type: string,
    profile: CustomerProfileRow,
    data: Record<string, unknown>
  ) {
    const updates: Record<string, unknown> = { updatedAt: new Date() };

    if (type === "bvn") {
      updates.bvn = data.bvn;
      updates.bvnVerified = true;
    } else if (type === "nin") {
      updates.nin = data.nin;
      updates.ninVerified = true;
    } else if (type === "address") {
      updates.address = data.address;
      updates.city = data.city;
      updates.state = data.state;
      updates.addressVerified = true;
    }

    await db
      .update(customerProfileTable)
      .set(updates as typeof customerProfileTable.$inferInsert)
      .where(eq(customerProfileTable.userId, userId));

    await this.upgradeLevel(userId);
  }

  private async upgradeLevel(userId: string) {
    const profile = await db.query.customerProfileTable.findFirst({
      where: eq(customerProfileTable.userId, userId)
    });

    if (!profile) return;

    let newLevel: CustomerLevel = 0;

    if (profile.ninVerified && profile.addressVerified) {
      newLevel = 3;
    } else if (profile.bvnVerified && profile.phoneVerified) {
      newLevel = 1;
    }

    if (newLevel > (profile.level as CustomerLevel)) {
      await db
        .update(customerProfileTable)
        .set({ level: newLevel, updatedAt: new Date() })
        .where(eq(customerProfileTable.userId, userId));
    }
  }

  async getPermanentAddress(userId: string) {
    const row = await db.query.permanentAddressTable.findFirst({
      where: eq(permanentAddressTable.userId, userId)
    });

    if (!row) return null;
    return mapPermanentAddress(row);
  }

  async getPermanentAccount(userId: string) {
    const row = await db.query.permanentAccountTable.findFirst({
      where: eq(permanentAccountTable.userId, userId)
    });

    if (!row) return null;
    return mapPermanentAccount(row);
  }
}

function mapPermanentAddress(row: typeof permanentAddressTable.$inferSelect) {
  return {
    currency: row.currency,
    network: row.network,
    accountId: row.accountId,
    address: row.address
  };
}

function mapPermanentAccount(row: typeof permanentAccountTable.$inferSelect) {
  return {
    accountId: row.accountId,
    bankName: row.bankName,
    accountNumber: row.accountNumber,
    accountName: row.accountName
  };
}
