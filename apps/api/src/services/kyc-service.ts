import { and, eq, gt } from "drizzle-orm";
import { randomInt } from "node:crypto";
import { db } from "../db/client.js";
import {
  customerProfileTable,
  kycSubmissionsTable,
  permanentAccountTable,
  permanentAddressTable,
  phoneOtpChallengesTable,
  type CustomerProfileRow,
} from "../db/schema.js";
import type { CustomerLevel, KycStatus } from "../lib/domain.js";
import { decryptSensitive, encryptSensitive, hashOtp } from "../lib/encryption.js";
import { logger } from "../lib/logger.js";
import { normalizePhone } from "../lib/phone.js";

const OTP_TTL_MS = 10 * 60 * 1000;

export class KycService {
  async submitBvnVerification(userId: string, bvn: string) {
    const inserted = await db
      .insert(kycSubmissionsTable)
      .values({
        userId,
        type: "bvn",
        status: "pending",
        data: { bvn: encryptSensitive(bvn) },
      })
      .returning();

    return inserted[0]!;
  }

  async submitNinVerification(userId: string, nin: string) {
    const inserted = await db
      .insert(kycSubmissionsTable)
      .values({
        userId,
        type: "nin",
        status: "pending",
        data: { nin: encryptSensitive(nin) },
      })
      .returning();

    return inserted[0]!;
  }

  async submitAddressVerification(userId: string, address: string, city: string, state: string) {
    const inserted = await db
      .insert(kycSubmissionsTable)
      .values({
        userId,
        type: "address",
        status: "pending",
        data: { address, city, state },
      })
      .returning();

    return inserted[0]!;
  }

  async requestPhoneOtp(userId: string, phone: string) {
    const normalizedPhone = normalizePhone(phone);
    const code = String(randomInt(100_000, 1_000_000));
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);

    await db.delete(phoneOtpChallengesTable).where(eq(phoneOtpChallengesTable.userId, userId));

    await db.insert(phoneOtpChallengesTable).values({
      userId,
      phone: normalizedPhone,
      codeHash: hashOtp(code),
      expiresAt,
    });

    await db
      .update(customerProfileTable)
      .set({ phone: normalizedPhone, updatedAt: new Date() })
      .where(eq(customerProfileTable.userId, userId));

    logger.debug("[kyc] phone OTP generated", { userId, phone: normalizedPhone, code });

    return {
      status: "otp_sent" as const,
      expiresAt: expiresAt.toISOString(),
    };
  }

  async verifyPhoneOtp(userId: string, code: string) {
    const challenge = await db.query.phoneOtpChallengesTable.findFirst({
      where: and(
        eq(phoneOtpChallengesTable.userId, userId),
        gt(phoneOtpChallengesTable.expiresAt, new Date()),
      ),
    });

    if (!challenge || challenge.codeHash !== hashOtp(code)) {
      throw new Error("Invalid or expired phone verification code");
    }

    await db
      .update(customerProfileTable)
      .set({ phoneVerified: true, phone: challenge.phone, updatedAt: new Date() })
      .where(eq(customerProfileTable.userId, userId));

    await db.delete(phoneOtpChallengesTable).where(eq(phoneOtpChallengesTable.userId, userId));
    await this.upgradeLevel(userId);

    return { status: "verified" as const };
  }

  async verifySubmission(
    submissionId: number,
    status: Extract<KycStatus, "verified" | "rejected">,
    rejectedReason?: string,
  ) {
    const updated = await db
      .update(kycSubmissionsTable)
      .set({
        status,
        verifiedAt: status === "verified" ? new Date() : null,
        rejectedReason: rejectedReason ?? null,
        updatedAt: new Date(),
      })
      .where(eq(kycSubmissionsTable.id, submissionId))
      .returning();

    if (updated.length === 0) {
      throw new Error(`KYC submission ${submissionId} not found`);
    }

    const submission = updated[0]!;
    const profile = await db.query.customerProfileTable.findFirst({
      where: eq(customerProfileTable.userId, submission.userId),
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
    data: Record<string, unknown>,
  ) {
    const updates: Record<string, unknown> = { updatedAt: new Date() };

    if (type === "bvn" && typeof data.bvn === "string") {
      updates.bvn = data.bvn.startsWith("enc:v1:") ? data.bvn : encryptSensitive(data.bvn);
      updates.bvnVerified = true;
    } else if (type === "nin" && typeof data.nin === "string") {
      updates.nin = data.nin.startsWith("enc:v1:") ? data.nin : encryptSensitive(data.nin);
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
      where: eq(customerProfileTable.userId, userId),
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
      where: eq(permanentAddressTable.userId, userId),
    });

    if (!row) return null;
    return mapPermanentAddress(row);
  }

  async getPermanentAccount(userId: string) {
    const row = await db.query.permanentAccountTable.findFirst({
      where: eq(permanentAccountTable.userId, userId),
    });

    if (!row) return null;
    return mapPermanentAccount(row);
  }

  getDecryptedIdentityValue(value?: string | null) {
    if (!value) {
      return undefined;
    }

    return value.startsWith("enc:v1:") ? decryptSensitive(value) : value;
  }
}

function mapPermanentAddress(row: typeof permanentAddressTable.$inferSelect) {
  return {
    currency: row.currency,
    network: row.network,
    accountId: row.accountId,
    address: row.address,
  };
}

function mapPermanentAccount(row: typeof permanentAccountTable.$inferSelect) {
  return {
    accountId: row.accountId,
    bankName: row.bankName,
    accountNumber: row.accountNumber,
    accountName: row.accountName,
  };
}
