import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import type { AppVariables } from "../lib/app-context.js";
import { sanitizeKycSubmission } from "../lib/kyc-response.js";
import { createRateLimiter, getClientIp } from "../lib/rate-limit.js";
import { KycService } from "../services/kyc-service.js";
import {
  createAdminAuditMiddleware,
  requireAdmin,
  requireAuth,
  requireAuthenticatedUser,
} from "./middleware.js";

const bvnSchema = z.object({
  bvn: z.string().regex(/^\d{11}$/),
});

const ninSchema = z.object({
  nin: z.string().regex(/^\d{11}$/),
});

const addressSchema = z.object({
  address: z.string().min(1),
  city: z.string().min(1),
  state: z.string().min(1),
});

const phoneRequestSchema = z.object({
  phone: z.string().min(10),
});

const phoneVerifySchema = z.object({
  code: z.string().regex(/^\d{6}$/),
});

const verifySchema = z.object({
  status: z.enum(["verified", "rejected"]),
  rejectedReason: z.string().optional(),
});

const kycRateLimit = createRateLimiter({
  keyPrefix: "kyc",
  limit: 15,
  windowMs: 60_000,
  keyResolver: (c) => c.get("user")?.id ?? getClientIp(c),
});

export function createKycRoutes(kycService: KycService) {
  const app = new Hono<{
    Variables: AppVariables;
  }>();

  app.use("*", requireAuth, kycRateLimit);

  app.post("/api/kyc/bvn", zValidator("json", bvnSchema), async (c) => {
    const user = requireAuthenticatedUser(c);
    const { bvn } = c.req.valid("json");
    const submission = await kycService.submitBvnVerification(user.id, bvn);
    return c.json({ submission: sanitizeKycSubmission(submission) }, 201);
  });

  app.post("/api/kyc/nin", zValidator("json", ninSchema), async (c) => {
    const user = requireAuthenticatedUser(c);
    const { nin } = c.req.valid("json");
    const submission = await kycService.submitNinVerification(user.id, nin);
    return c.json({ submission: sanitizeKycSubmission(submission) }, 201);
  });

  app.post("/api/kyc/address", zValidator("json", addressSchema), async (c) => {
    const user = requireAuthenticatedUser(c);
    const { address, city, state } = c.req.valid("json");
    const submission = await kycService.submitAddressVerification(user.id, address, city, state);
    return c.json({ submission: sanitizeKycSubmission(submission) }, 201);
  });

  app.post("/api/kyc/phone/request", zValidator("json", phoneRequestSchema), async (c) => {
    const user = requireAuthenticatedUser(c);
    const { phone } = c.req.valid("json");
    const result = await kycService.requestPhoneOtp(user.id, phone);
    return c.json(result);
  });

  app.post("/api/kyc/phone/verify", zValidator("json", phoneVerifySchema), async (c) => {
    const user = requireAuthenticatedUser(c);
    const { code } = c.req.valid("json");
    const result = await kycService.verifyPhoneOtp(user.id, code);
    return c.json(result);
  });

  app.post(
    "/api/admin/kyc/:id/verify",
    requireAdmin,
    createAdminAuditMiddleware("kyc.verify"),
    zValidator("json", verifySchema),
    async (c) => {
      const id = Number(c.req.param("id"));
      const { status, rejectedReason } = c.req.valid("json");
      const submission = await kycService.verifySubmission(id, status, rejectedReason);
      return c.json({ submission: sanitizeKycSubmission(submission) });
    },
  );

  return app;
}
