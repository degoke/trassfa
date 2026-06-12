import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import type { AppVariables } from "../lib/app-context.js";
import { KycService } from "../services/kyc-service.js";
import { requireAuth, requireAuthenticatedUser } from "./middleware.js";

const bvnSchema = z.object({
  bvn: z.string().length(11)
});

const ninSchema = z.object({
  nin: z.string().length(11)
});

const addressSchema = z.object({
  address: z.string().min(1),
  city: z.string().min(1),
  state: z.string().min(1)
});

const phoneSchema = z.object({
  phone: z.string().min(10)
});

const verifySchema = z.object({
  status: z.enum(["verified", "rejected"]),
  rejectedReason: z.string().optional()
});

export function createKycRoutes(kycService: KycService) {
  const app = new Hono<{
    Variables: AppVariables;
  }>();

  app.use("*", requireAuth);

  app.post("/api/kyc/bvn", zValidator("json", bvnSchema), async (c) => {
    const user = requireAuthenticatedUser(c);
    const { bvn } = c.req.valid("json");
    const submission = await kycService.submitBvnVerification(user.id, bvn);
    return c.json({ submission }, 201);
  });

  app.post("/api/kyc/nin", zValidator("json", ninSchema), async (c) => {
    const user = requireAuthenticatedUser(c);
    const { nin } = c.req.valid("json");
    const submission = await kycService.submitNinVerification(user.id, nin);
    return c.json({ submission }, 201);
  });

  app.post("/api/kyc/address", zValidator("json", addressSchema), async (c) => {
    const user = requireAuthenticatedUser(c);
    const { address, city, state } = c.req.valid("json");
    const submission = await kycService.submitAddressVerification(user.id, address, city, state);
    return c.json({ submission }, 201);
  });

  app.post("/api/kyc/phone", zValidator("json", phoneSchema), async (c) => {
    const user = requireAuthenticatedUser(c);
    await kycService.verifyPhone(user.id);
    return c.json({ status: "verified" });
  });

  app.post(
    "/api/admin/kyc/:id/verify",
    zValidator("json", verifySchema),
    async (c) => {
      const id = Number(c.req.param("id"));
      const { status, rejectedReason } = c.req.valid("json");
      const submission = await kycService.verifySubmission(id, status, rejectedReason);
      return c.json({ submission });
    }
  );

  return app;
}
