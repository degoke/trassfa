import { env } from "./config.js";

export function getPublicErrorMessage(error: unknown) {
  if (env.NODE_ENV === "production") {
    return "Internal server error";
  }

  return error instanceof Error ? error.message : "Internal server error";
}
