import { Hono } from "hono";
import type { AppVariables } from "../lib/app-context.js";
import { KycService } from "../services/kyc-service.js";
import { TransactionRepository } from "../repositories/transaction-repository.js";
import { currencyLevelLimits, levelPermissions, type LevelPermissions } from "../config/limits.js";
import { requireAuth, requireAuthenticatedUser } from "./middleware.js";

const defaultPermissions: LevelPermissions = {
  allowPermanentAddress: false,
  allowPermanentAccount: false,
};

export function createProfileRoutes(
  kycService: KycService,
  transactionRepository: TransactionRepository,
) {
  const app = new Hono<{
    Variables: AppVariables;
  }>();

  app.use("*", requireAuth);

  app.get("/api/profile", async (c) => {
    const user = requireAuthenticatedUser(c);
    const profile = await transactionRepository.getCustomerProfile(user.id);

    if (!profile) {
      return c.json({ error: "Profile not found" }, 404);
    }

    return c.json({
      profile: {
        id: profile.id,
        firstName: profile.firstName,
        lastName: profile.lastName,
        email: profile.email,
        phone: profile.phone,
        level: profile.level,
        bvnVerified: profile.bvnVerified,
        ninVerified: profile.ninVerified,
        phoneVerified: profile.phoneVerified,
        addressVerified: profile.addressVerified,
        address: profile.address,
        city: profile.city,
        state: profile.state,
        country: profile.country,
        dateOfBirth: profile.dateOfBirth,
      },
    });
  });

  app.get("/api/profile/limits", async (c) => {
    const user = requireAuthenticatedUser(c);
    const profile = await transactionRepository.getCustomerProfile(user.id);
    const level = (profile?.level ?? 0) as keyof typeof currencyLevelLimits.NGN;
    const permissions = levelPermissions[level] ?? levelPermissions[0];

    const limits: Record<string, unknown> = {};
    for (const [currency, levels] of Object.entries(currencyLevelLimits)) {
      limits[currency] = levels[level] ?? levels[0];
    }

    return c.json({
      level,
      limits,
      permissions,
    });
  });

  app.get("/api/profile/permanent-address", async (c) => {
    const user = requireAuthenticatedUser(c);
    const profile = await transactionRepository.getCustomerProfile(user.id);
    const level = (profile?.level ?? 0) as keyof typeof levelPermissions;
    const permissions = levelPermissions[level] ?? defaultPermissions;

    if (!permissions.allowPermanentAddress) {
      return c.json(
        { error: "Permanent address is not available at your verification level" },
        403,
      );
    }

    const address = await kycService.getPermanentAddress(user.id);
    return c.json({ address });
  });

  app.get("/api/profile/permanent-account", async (c) => {
    const user = requireAuthenticatedUser(c);
    const profile = await transactionRepository.getCustomerProfile(user.id);
    const level = (profile?.level ?? 0) as keyof typeof levelPermissions;
    const permissions = levelPermissions[level] ?? defaultPermissions;

    if (!permissions.allowPermanentAccount) {
      return c.json(
        { error: "Permanent account is not available at your verification level" },
        403,
      );
    }

    const account = await kycService.getPermanentAccount(user.id);
    return c.json({ account });
  });

  return app;
}
