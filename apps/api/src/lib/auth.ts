import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { db } from "../db/client.js";
import * as schema from "../db/schema.js";
import { env } from "./config.js";

export const auth = betterAuth({
  appName: "trassfa",
  baseURL: env.BETTER_AUTH_URL,
  basePath: "/api/auth",
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: [env.WEB_APP_URL],
  emailAndPassword: {
    enabled: true,
  },
  user: {
    additionalFields: {
      phone: {
        type: "string",
        required: true,
      },
    },
  },
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
});
