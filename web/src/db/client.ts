/**
 * Database client.
 *
 * Two drivers, chosen from the connection string:
 *
 * - **Neon** (`*.neon.tech`) uses the serverless HTTP driver, which works on
 *   Vercel's serverless runtime without connection-pooling headaches. This is
 *   the deployment target.
 * - **Anything else** uses node-postgres, so the app runs against a plain local
 *   Postgres. The Neon HTTP driver speaks Neon's own protocol and cannot talk
 *   to an ordinary server, so without this branch nothing here is testable
 *   without a network round trip to production.
 *
 * Same Drizzle API either way — no calling code needs to know which is in use.
 *
 * Initialisation is LAZY on purpose: `next build` walks the module graph while
 * collecting page data, so an import-time throw would make the build itself
 * require DATABASE_URL. Deferring to first query means a fresh Vercel project
 * builds green before its env vars exist, and only page requests fail until
 * they are set — which is the failure you want, with the message you want.
 */

import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { drizzle as drizzlePg, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

type Db = NodePgDatabase<typeof schema>;

/** Neon's HTTP endpoint is the only thing the serverless driver can address. */
function isNeon(url: string): boolean {
  return /\.neon\.tech(:|\/|$)/.test(url);
}

/**
 * Reused across hot reloads in dev; without this, every edit leaks a pool and
 * Postgres runs out of connections after a few dozen saves.
 */
const globalForDb = globalThis as unknown as { __ootpPool?: Pool; __ootpDb?: Db };

function createDb(): Db {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Locally: copy .env.example to .env.local. On Vercel: add DATABASE_URL (plus AUTH_SECRET and APP_PASSWORD) in Project Settings → Environment Variables, then redeploy.",
    );
  }

  /**
   * Typed as the node-postgres flavour rather than a union of the two.
   *
   * The two drivers expose the same query-builder API but not identical
   * generic signatures, and a union of them collapses overloads like
   * `.returning(...)` down to their incompatible intersection — which fails to
   * typecheck at every call site even though both drivers accept the call at
   * runtime. One concrete type keeps callers honest; the runtime choice is
   * still made here.
   */
  return isNeon(connectionString)
    ? (drizzleNeon(neon(connectionString), { schema }) as unknown as Db)
    : drizzlePg(
        (globalForDb.__ootpPool ??= new Pool({
          connectionString,
          // Local Postgres has no TLS; hosted providers generally require it.
          ssl: /localhost|127\.0\.0\.1/.test(connectionString)
            ? false
            : { rejectUnauthorized: false },
        })),
        { schema },
      );
}

/**
 * A Proxy standing in front of the real client: the first property access
 * builds it (and caches on globalThis for dev hot reloads). Every Drizzle
 * call site keeps the exact same `db.select()...` shape.
 */
export const db: Db = new Proxy({} as Db, {
  get(_target, prop, receiver) {
    const real = (globalForDb.__ootpDb ??= createDb());
    const value = Reflect.get(real as object, prop, receiver);
    return typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(real) : value;
  },
});

export { schema };
