import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync } from "node:crypto";
import { env, isProduction } from "./config.js";

const ENCRYPTION_PREFIX = "enc:v1:";
const IV_LENGTH = 12;
const DEV_FALLBACK_KEY = "development-only-encryption-key-32";

function getEncryptionKey() {
  const value = env.ENCRYPTION_KEY ?? (isProduction ? undefined : DEV_FALLBACK_KEY);

  if (!value) {
    throw new Error("ENCRYPTION_KEY is required to handle sensitive identity data");
  }

  return scryptSync(value, "trassfa-sensitive-salt", 32);
}

export function encryptSensitive(value: string) {
  if (value.startsWith(ENCRYPTION_PREFIX)) {
    return value;
  }

  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${ENCRYPTION_PREFIX}${Buffer.concat([iv, authTag, encrypted]).toString("base64")}`;
}

export function decryptSensitive(value: string) {
  if (!value.startsWith(ENCRYPTION_PREFIX)) {
    return value;
  }

  const payload = Buffer.from(value.slice(ENCRYPTION_PREFIX.length), "base64");
  const iv = payload.subarray(0, IV_LENGTH);
  const authTag = payload.subarray(IV_LENGTH, IV_LENGTH + 16);
  const encrypted = payload.subarray(IV_LENGTH + 16);
  const decipher = createDecipheriv("aes-256-gcm", getEncryptionKey(), iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

export function maskSensitiveIdentifier(value?: string | null) {
  if (!value) {
    return undefined;
  }

  const plain = value.startsWith(ENCRYPTION_PREFIX) ? decryptSensitive(value) : value;
  if (plain.length <= 4) {
    return "****";
  }

  return `***${plain.slice(-4)}`;
}

export function hashOtp(code: string) {
  return createHash("sha256").update(code).digest("hex");
}
