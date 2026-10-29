/**
 * Applies pending SQL migrations from src/migrations. Used by the Docker image
 * at startup: `bun packages/db/src/migrate.ts`.
 */
import { fileURLToPath } from "node:url";

import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

const url = process.env.DATABASE_URL;
if (!url) {
	console.error("[migrate] DATABASE_URL is not set");
	process.exit(1);
}

const migrationsFolder = fileURLToPath(
	new URL("./migrations", import.meta.url)
);
const db = drizzle(url);

const MAX_ATTEMPTS = 10;
const RETRY_MS = 3000;

for (let attempt = 1; ; attempt += 1) {
	try {
		// biome-ignore lint/performance/noAwaitInLoops: retry until the database accepts connections
		await migrate(db, { migrationsFolder });
		console.info("[migrate] database is up to date");
		break;
	} catch (error) {
		if (attempt >= MAX_ATTEMPTS) {
			console.error("[migrate] failed:", error);
			process.exit(1);
		}
		console.warn(
			`[migrate] attempt ${attempt} failed, retrying…`,
			(error as Error).message
		);
		await Bun.sleep(RETRY_MS);
	}
}
await db.$client.end();
