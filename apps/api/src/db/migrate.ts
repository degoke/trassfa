import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, pool } from "./client.js";

async function main() {
  await migrate(db, {
    migrationsFolder: "./drizzle",
  });

  console.log("Applied Drizzle migrations.");
}

main()
  .catch((error) => {
    console.error("Failed to apply Drizzle migrations.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
