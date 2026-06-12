import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import type { AppVariables } from "../lib/app-context.js";
import type { SkyewalletClient } from "../lib/skyewallet.js";
import { requireAuth, requireAuthenticatedUser } from "./middleware.js";

const validateAddressSchema = z.object({
  address: z.string().min(1),
  currency: z.enum(["USDT", "USDC"]),
  network: z.enum(["TRX", "SOL"])
});

export function createWalletRoutes(skyewallet: SkyewalletClient) {
  const app = new Hono<{
    Variables: AppVariables;
  }>();

  app.use("*", requireAuth);

  app.post(
    "/api/wallets/validate",
    zValidator("json", validateAddressSchema),
    async (c) => {
      requireAuthenticatedUser(c);
      const body = c.req.valid("json");

      const validation = await skyewallet.validateAddress(body);

      if (!validation.data.valid) {
        return c.json({
          valid: false,
          message: validation.error?.message ?? `Invalid ${body.currency} address for ${body.network} network`
        });
      }

      return c.json({ valid: true });
    }
  );

  return app;
}
