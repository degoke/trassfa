import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(scriptDir, "..");

loadEnv({ path: resolve(rootDir, ".env.example") });
loadEnv({ path: resolve(rootDir, ".env"), override: true });

const command = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const result = spawnSync(
  command,
  ["exec", "auth", "generate", "--config", "./src/lib/auth.ts", "--output", "./src/db/auth-schema.ts", "-y"],
  {
    cwd: rootDir,
    env: process.env,
    stdio: "inherit"
  }
);

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
